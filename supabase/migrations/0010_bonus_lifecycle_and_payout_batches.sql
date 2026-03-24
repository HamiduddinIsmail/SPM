-- Bonus lifecycle actions and payout batches

create table if not exists public.bonus_payout_batches (
  id uuid primary key default gen_random_uuid(),
  period_year int not null check (period_year between 2000 and 2100),
  period_month int not null check (period_month between 1 and 12),
  external_batch_id text,
  total_items int not null default 0,
  total_amount_rm numeric(12,2) not null default 0,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bonus_status_history (
  id uuid primary key default gen_random_uuid(),
  bonus_record_id uuid not null references public.bonus_records(id),
  from_status text,
  to_status text not null check (to_status in ('pending', 'confirmed', 'paid', 'cancelled')),
  changed_by_user_id uuid not null,
  changed_at timestamptz not null default now(),
  reason text
);

alter table public.bonus_records
  add column if not exists confirmed_by_user_id uuid,
  add column if not exists confirmed_at timestamptz,
  add column if not exists paid_by_user_id uuid,
  add column if not exists paid_at timestamptz,
  add column if not exists payout_batch_id uuid references public.bonus_payout_batches(id);

create or replace function public.confirm_bonuses_for_period(
  p_year int,
  p_month int,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_count int := 0;
begin
  if p_year < 2000 or p_year > 2100 then
    raise exception 'INVALID_YEAR';
  end if;

  if p_month < 1 or p_month > 12 then
    raise exception 'INVALID_MONTH';
  end if;

  insert into public.bonus_status_history (
    bonus_record_id,
    from_status,
    to_status,
    changed_by_user_id,
    reason
  )
  select
    br.id,
    br.status,
    'confirmed',
    p_actor_user_id,
    'Monthly bonus confirmation'
  from public.bonus_records br
  where br.period_year = p_year
    and br.period_month = p_month
    and br.status = 'pending';

  update public.bonus_records
  set
    status = 'confirmed',
    confirmed_by_user_id = p_actor_user_id,
    confirmed_at = now()
  where period_year = p_year
    and period_month = p_month
    and status = 'pending';

  get diagnostics v_count = row_count;

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
    'bonus.period_confirmed',
    'bonus_batch',
    gen_random_uuid(),
    null,
    jsonb_build_object(
      'year', p_year,
      'month', p_month,
      'confirmed_count', v_count
    ),
    'Confirmed pending bonuses for period'
  );

  return jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'confirmed_count', v_count
  );
end;
$$;

create or replace function public.pay_confirmed_bonuses_for_period(
  p_year int,
  p_month int,
  p_actor_user_id uuid,
  p_external_batch_id text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_batch_id uuid;
  v_total_items int := 0;
  v_total_amount numeric(12,2) := 0;
begin
  if p_year < 2000 or p_year > 2100 then
    raise exception 'INVALID_YEAR';
  end if;

  if p_month < 1 or p_month > 12 then
    raise exception 'INVALID_MONTH';
  end if;

  select count(*), coalesce(sum(amount_rm), 0)
  into v_total_items, v_total_amount
  from public.bonus_records
  where period_year = p_year
    and period_month = p_month
    and status = 'confirmed';

  if v_total_items = 0 then
    return jsonb_build_object(
      'year', p_year,
      'month', p_month,
      'payout_batch_id', null,
      'paid_count', 0,
      'paid_total_amount_rm', 0
    );
  end if;

  insert into public.bonus_payout_batches (
    period_year,
    period_month,
    external_batch_id,
    total_items,
    total_amount_rm,
    created_by_user_id
  )
  values (
    p_year,
    p_month,
    nullif(trim(coalesce(p_external_batch_id, '')), ''),
    v_total_items,
    v_total_amount,
    p_actor_user_id
  )
  returning id into v_batch_id;

  insert into public.bonus_status_history (
    bonus_record_id,
    from_status,
    to_status,
    changed_by_user_id,
    reason
  )
  select
    br.id,
    br.status,
    'paid',
    p_actor_user_id,
    'Bonus paid in payout batch ' || v_batch_id::text
  from public.bonus_records br
  where br.period_year = p_year
    and br.period_month = p_month
    and br.status = 'confirmed';

  update public.bonus_records
  set
    status = 'paid',
    paid_by_user_id = p_actor_user_id,
    paid_at = now(),
    payout_batch_id = v_batch_id
  where period_year = p_year
    and period_month = p_month
    and status = 'confirmed';

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
    'bonus.period_paid',
    'bonus_batch',
    v_batch_id,
    null,
    jsonb_build_object(
      'year', p_year,
      'month', p_month,
      'paid_count', v_total_items,
      'paid_total_amount_rm', v_total_amount
    ),
    'Paid confirmed bonuses for period'
  );

  return jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'payout_batch_id', v_batch_id,
    'paid_count', v_total_items,
    'paid_total_amount_rm', v_total_amount
  );
end;
$$;
