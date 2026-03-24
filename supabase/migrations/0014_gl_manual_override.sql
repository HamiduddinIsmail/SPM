-- Manual GL override: admin selects explicit GL + reason.

create or replace function public.manual_override_group_leader_for_booking(
  p_booking_id uuid,
  p_group_leader_agent_id uuid,
  p_actor_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_booking_status text;
  v_current_gl uuid;
  v_reason text;
begin
  select status, group_leader_agent_id
  into v_booking_status, v_current_gl
  from public.bookings
  where id = p_booking_id
  for update;

  if v_booking_status is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_booking_status = 'cancelled' then
    raise exception 'CANNOT_OVERRIDE_GL_FOR_CANCELLED_BOOKING';
  end if;

  if p_group_leader_agent_id is null then
    raise exception 'GROUP_LEADER_AGENT_ID_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_group_leader_agent_id
      and p.role = 'agent'
  ) then
    raise exception 'INVALID_GL_AGENT';
  end if;

  v_reason := trim(coalesce(p_reason, ''));
  if length(v_reason) = 0 then
    raise exception 'REASON_REQUIRED';
  end if;

  if length(v_reason) > 255 then
    raise exception 'REASON_TOO_LONG';
  end if;

  update public.bookings
  set group_leader_agent_id = p_group_leader_agent_id
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
    p_group_leader_agent_id,
    'manual_override',
    v_reason,
    p_actor_user_id
  )
  on conflict (booking_id) do update
    set group_leader_agent_id = excluded.group_leader_agent_id,
        assignment_type = excluded.assignment_type,
        assignment_reason = excluded.assignment_reason,
        assigned_by_user_id = excluded.assigned_by_user_id,
        created_at = now();

  insert into public.agent_travel_history (agent_id, has_travelled, first_travelled_at)
  values (p_group_leader_agent_id, true, now())
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
    'gl.manual_override',
    'booking',
    p_booking_id,
    jsonb_build_object('group_leader_agent_id', v_current_gl),
    jsonb_build_object('group_leader_agent_id', p_group_leader_agent_id, 'assignment_type', 'manual_override'),
    v_reason
  );

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'group_leader_agent_id', p_group_leader_agent_id,
    'assignment_type', 'manual_override',
    'assignment_reason', v_reason
  );
end;
$$;
