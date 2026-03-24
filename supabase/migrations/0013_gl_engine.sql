-- GL Engine V1
-- Qualification: agent with >= 20 verified pax (current proxy: verified booking count).
-- Fallback fairness: eligible agents who have never travelled, then least prior assignments.

alter table public.bookings
  add column if not exists group_leader_agent_id uuid;

create table if not exists public.agent_travel_history (
  agent_id uuid primary key,
  has_travelled boolean not null default false,
  first_travelled_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.group_leader_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id),
  group_leader_agent_id uuid not null,
  assignment_type text not null check (assignment_type in ('qualified', 'fairness_fallback', 'manual_override')),
  assignment_reason text not null,
  assigned_by_user_id uuid not null,
  created_at timestamptz not null default now()
);

create or replace function public.agent_verified_pax_count(
  p_agent_id uuid
)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  -- Pax proxy for V1: one verified booking = one pax for closing agent.
  select count(distinct b.id)::int
  into v_count
  from public.bookings b
  join public.commission_records cr on cr.booking_id = b.id
  where b.status = 'verified'
    and cr.commission_type = 'normal'
    and cr.beneficiary_agent_id = p_agent_id
    and cr.status in ('confirmed', 'paid');

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.assign_group_leader_for_booking(
  p_booking_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_booking_status text;
  v_existing_gl uuid;
  v_selected_gl uuid;
  v_assignment_type text;
  v_assignment_reason text;
  v_verified_pax int;
begin
  select status, group_leader_agent_id
  into v_booking_status, v_existing_gl
  from public.bookings
  where id = p_booking_id
  for update;

  if v_booking_status is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_booking_status = 'cancelled' then
    raise exception 'CANNOT_ASSIGN_GL_TO_CANCELLED_BOOKING';
  end if;

  if v_existing_gl is not null then
    return jsonb_build_object(
      'booking_id', p_booking_id,
      'group_leader_agent_id', v_existing_gl,
      'assignment_type', 'existing',
      'assignment_reason', 'Booking already has assigned GL'
    );
  end if;

  -- 1) Qualified GL: verified pax >= 20
  select p.id, public.agent_verified_pax_count(p.id)
  into v_selected_gl, v_verified_pax
  from public.profiles p
  where p.role = 'agent'
    and public.agent_verified_pax_count(p.id) >= 20
  order by public.agent_verified_pax_count(p.id) desc, p.created_at asc
  limit 1;

  if v_selected_gl is not null then
    v_assignment_type := 'qualified';
    v_assignment_reason := 'Assigned qualified GL with >=20 verified pax';
  else
    -- 2) Fairness fallback: never-travelled first, then least prior assignments.
    select p.id
    into v_selected_gl
    from public.profiles p
    left join public.agent_travel_history ath on ath.agent_id = p.id
    where p.role = 'agent'
      and coalesce(ath.has_travelled, false) = false
    order by (
      select count(*)
      from public.group_leader_assignments gla
      where gla.group_leader_agent_id = p.id
    ) asc, p.created_at asc
    limit 1;

    if v_selected_gl is not null then
      v_assignment_type := 'fairness_fallback';
      v_assignment_reason := 'No qualified GL; assigned by fairness (never-travelled, least assignments)';
    end if;
  end if;

  if v_selected_gl is null then
    raise exception 'NO_ELIGIBLE_GL_FOUND';
  end if;

  update public.bookings
  set group_leader_agent_id = v_selected_gl
  where id = p_booking_id;

  insert into public.group_leader_assignments (
    booking_id,
    group_leader_agent_id,
    assignment_type,
    assignment_reason,
    assigned_by_user_id
  )
  values (
    p_booking_id,
    v_selected_gl,
    v_assignment_type,
    v_assignment_reason,
    p_actor_user_id
  );

  insert into public.agent_travel_history (agent_id, has_travelled, first_travelled_at)
  values (v_selected_gl, true, now())
  on conflict (agent_id) do update
    set has_travelled = true,
        first_travelled_at = coalesce(public.agent_travel_history.first_travelled_at, excluded.first_travelled_at),
        updated_at = now();

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    reason
  )
  values (
    p_actor_user_id,
    'gl.assigned',
    'booking',
    p_booking_id,
    null,
    jsonb_build_object(
      'group_leader_agent_id', v_selected_gl,
      'assignment_type', v_assignment_type
    ),
    v_assignment_reason
  );

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'group_leader_agent_id', v_selected_gl,
    'assignment_type', v_assignment_type,
    'assignment_reason', v_assignment_reason
  );
end;
$$;

-- RLS for GL tables
alter table public.group_leader_assignments enable row level security;
alter table public.agent_travel_history enable row level security;

drop policy if exists group_leader_assignments_select_admin_only on public.group_leader_assignments;
create policy group_leader_assignments_select_admin_only
on public.group_leader_assignments
for select
to authenticated
using (public.current_app_role() in ('superadmin', 'admin'));

drop policy if exists agent_travel_history_select_admin_only on public.agent_travel_history;
create policy agent_travel_history_select_admin_only
on public.agent_travel_history
for select
to authenticated
using (public.current_app_role() in ('superadmin', 'admin'));
