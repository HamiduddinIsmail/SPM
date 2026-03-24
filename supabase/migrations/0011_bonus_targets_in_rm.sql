-- Make bonus targets configurable in RM values.

insert into public.bonus_rule_configs (rule_key, int_value, numeric_value, is_active, description)
values
  ('individual_target_rm', null, 30000.00, true, 'Individual monthly sales amount target in RM'),
  ('group_target_rm', null, 100000.00, true, 'Group monthly sales amount target in RM')
on conflict (rule_key) do nothing;

alter table public.bonus_records
  add column if not exists personal_sales_amount_rm numeric(12,2) not null default 0,
  add column if not exists group_sales_amount_rm numeric(12,2) not null default 0;

create or replace function public.agent_successful_sales_amount_between(
  p_agent_id uuid,
  p_start_ts timestamptz,
  p_end_ts timestamptz
)
returns numeric
language plpgsql
as $$
declare
  v_amount numeric;
begin
  select coalesce(sum(b.total_amount_rm), 0)
  into v_amount
  from public.commission_records cr
  join public.bookings b on b.id = cr.booking_id
  where cr.beneficiary_agent_id = p_agent_id
    and cr.commission_type = 'normal'
    and cr.status in ('confirmed', 'paid')
    and b.verified_at is not null
    and b.verified_at >= p_start_ts
    and b.verified_at < p_end_ts;

  return coalesce(v_amount, 0);
end;
$$;

create or replace function public.agent_group_successful_sales_amount_between(
  p_root_agent_id uuid,
  p_start_ts timestamptz,
  p_end_ts timestamptz
)
returns numeric
language sql
as $$
  with recursive downline(agent_id) as (
    select p_root_agent_id
    union
    select ah.child_agent_id
    from public.agent_hierarchy ah
    join downline d on ah.parent_agent_id = d.agent_id
    where ah.level_depth = 1
      and ah.effective_from <= p_end_ts
      and (ah.effective_to is null or ah.effective_to > p_start_ts)
  )
  select coalesce(sum(b.total_amount_rm), 0)
  from public.commission_records cr
  join public.bookings b on b.id = cr.booking_id
  where cr.commission_type = 'normal'
    and cr.status in ('confirmed', 'paid')
    and cr.beneficiary_agent_id in (select agent_id from downline)
    and b.verified_at is not null
    and b.verified_at >= p_start_ts
    and b.verified_at < p_end_ts;
$$;

create or replace function public.calculate_monthly_bonuses(
  p_year int,
  p_month int,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_individual_min_sales int;
  v_group_min_personal_sales int;
  v_individual_target_rm numeric(12,2);
  v_group_target_rm numeric(12,2);
  v_individual_bonus_amount numeric(12,2);
  v_group_bonus_amount numeric(12,2);
  v_personal_sales int;
  v_group_sales int;
  v_personal_sales_amount_rm numeric(12,2);
  v_group_sales_amount_rm numeric(12,2);
  v_created_individual int := 0;
  v_created_group int := 0;
  v_agent record;
begin
  if p_year < 2000 or p_year > 2100 then
    raise exception 'INVALID_YEAR';
  end if;

  if p_month < 1 or p_month > 12 then
    raise exception 'INVALID_MONTH';
  end if;

  v_start_ts := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_end_ts := v_start_ts + interval '1 month';

  v_individual_min_sales := public.get_bonus_config_int('individual_min_sales', 2);
  v_group_min_personal_sales := public.get_bonus_config_int('group_min_personal_sales', 2);
  v_individual_target_rm := public.get_bonus_config_numeric('individual_target_rm', 30000);
  v_group_target_rm := public.get_bonus_config_numeric('group_target_rm', 100000);
  v_individual_bonus_amount := public.get_bonus_config_numeric('individual_bonus_amount', 200);
  v_group_bonus_amount := public.get_bonus_config_numeric('group_bonus_amount', 300);

  for v_agent in
    select id
    from public.profiles
    where role = 'agent'
  loop
    v_personal_sales := public.agent_successful_sales_count_between(v_agent.id, v_start_ts, v_end_ts);
    v_group_sales := public.agent_group_successful_sales_count_between(v_agent.id, v_start_ts, v_end_ts);
    v_personal_sales_amount_rm := public.agent_successful_sales_amount_between(v_agent.id, v_start_ts, v_end_ts);
    v_group_sales_amount_rm := public.agent_group_successful_sales_amount_between(v_agent.id, v_start_ts, v_end_ts);

    if v_personal_sales >= v_individual_min_sales
      and v_personal_sales_amount_rm >= v_individual_target_rm then
      insert into public.bonus_records (
        beneficiary_agent_id,
        bonus_type,
        period_year,
        period_month,
        personal_sales_count,
        group_sales_count,
        personal_sales_amount_rm,
        group_sales_amount_rm,
        amount_rm,
        status
      )
      values (
        v_agent.id,
        'individual',
        p_year,
        p_month,
        v_personal_sales,
        v_group_sales,
        v_personal_sales_amount_rm,
        v_group_sales_amount_rm,
        v_individual_bonus_amount,
        'pending'
      )
      on conflict (beneficiary_agent_id, bonus_type, period_year, period_month) do nothing;

      if found then
        v_created_individual := v_created_individual + 1;
      end if;
    end if;

    if v_personal_sales >= v_group_min_personal_sales
      and v_group_sales_amount_rm >= v_group_target_rm then
      insert into public.bonus_records (
        beneficiary_agent_id,
        bonus_type,
        period_year,
        period_month,
        personal_sales_count,
        group_sales_count,
        personal_sales_amount_rm,
        group_sales_amount_rm,
        amount_rm,
        status
      )
      values (
        v_agent.id,
        'group',
        p_year,
        p_month,
        v_personal_sales,
        v_group_sales,
        v_personal_sales_amount_rm,
        v_group_sales_amount_rm,
        v_group_bonus_amount,
        'pending'
      )
      on conflict (beneficiary_agent_id, bonus_type, period_year, period_month) do nothing;

      if found then
        v_created_group := v_created_group + 1;
      end if;
    end if;
  end loop;

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
    'bonus.monthly_calculated',
    'bonus_batch',
    gen_random_uuid(),
    null,
    jsonb_build_object(
      'year', p_year,
      'month', p_month,
      'created_individual', v_created_individual,
      'created_group', v_created_group,
      'individual_target_rm', v_individual_target_rm,
      'group_target_rm', v_group_target_rm
    ),
    'Monthly bonus calculation (RM thresholds)'
  );

  return jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'created_individual', v_created_individual,
    'created_group', v_created_group,
    'individual_target_rm', v_individual_target_rm,
    'group_target_rm', v_group_target_rm
  );
end;
$$;
