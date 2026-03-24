-- Bonus Engine V1 (monthly individual + group bonuses)

create table if not exists public.bonus_rule_configs (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  int_value int,
  numeric_value numeric(12,2),
  is_active boolean not null default true,
  description text,
  updated_at timestamptz not null default now()
);

create or replace function public.set_bonus_rule_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bonus_rule_configs_updated_at on public.bonus_rule_configs;
create trigger trg_bonus_rule_configs_updated_at
before update on public.bonus_rule_configs
for each row
execute function public.set_bonus_rule_updated_at();

insert into public.bonus_rule_configs (rule_key, int_value, numeric_value, is_active, description)
values
  ('individual_min_sales', 2, null, true, 'Minimum personal successful sales for individual bonus'),
  ('individual_target_sales', 5, null, true, 'Personal successful sales target for individual bonus'),
  ('individual_bonus_amount', null, 200.00, true, 'Fixed individual bonus amount'),
  ('group_min_personal_sales', 2, null, true, 'Minimum personal successful sales for group bonus'),
  ('group_target_sales', 20, null, true, 'Group successful sales target for group bonus'),
  ('group_bonus_amount', null, 300.00, true, 'Fixed group bonus amount')
on conflict (rule_key) do nothing;

create table if not exists public.bonus_records (
  id uuid primary key default gen_random_uuid(),
  beneficiary_agent_id uuid not null,
  bonus_type text not null check (bonus_type in ('individual', 'group')),
  period_year int not null check (period_year between 2000 and 2100),
  period_month int not null check (period_month between 1 and 12),
  personal_sales_count int not null default 0,
  group_sales_count int not null default 0,
  amount_rm numeric(12,2) not null check (amount_rm >= 0),
  status text not null check (status in ('pending', 'confirmed', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (beneficiary_agent_id, bonus_type, period_year, period_month)
);

create or replace function public.get_bonus_config_int(
  p_rule_key text,
  p_default int
)
returns int
language plpgsql
as $$
declare
  v_value int;
begin
  select int_value
  into v_value
  from public.bonus_rule_configs
  where rule_key = p_rule_key
    and is_active = true
  limit 1;

  return coalesce(v_value, p_default);
end;
$$;

create or replace function public.get_bonus_config_numeric(
  p_rule_key text,
  p_default numeric
)
returns numeric
language plpgsql
as $$
declare
  v_value numeric;
begin
  select numeric_value
  into v_value
  from public.bonus_rule_configs
  where rule_key = p_rule_key
    and is_active = true
  limit 1;

  return coalesce(v_value, p_default);
end;
$$;

create or replace function public.agent_successful_sales_count_between(
  p_agent_id uuid,
  p_start_ts timestamptz,
  p_end_ts timestamptz
)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  select count(distinct cr.booking_id)::int
  into v_count
  from public.commission_records cr
  join public.bookings b on b.id = cr.booking_id
  where cr.beneficiary_agent_id = p_agent_id
    and cr.commission_type = 'normal'
    and cr.status in ('confirmed', 'paid')
    and b.verified_at is not null
    and b.verified_at >= p_start_ts
    and b.verified_at < p_end_ts;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.agent_group_successful_sales_count_between(
  p_root_agent_id uuid,
  p_start_ts timestamptz,
  p_end_ts timestamptz
)
returns int
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
  select coalesce(count(distinct cr.booking_id), 0)::int
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
  v_individual_target_sales int;
  v_individual_bonus_amount numeric(12,2);
  v_group_min_personal_sales int;
  v_group_target_sales int;
  v_group_bonus_amount numeric(12,2);
  v_personal_sales int;
  v_group_sales int;
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
  v_individual_target_sales := public.get_bonus_config_int('individual_target_sales', 5);
  v_individual_bonus_amount := public.get_bonus_config_numeric('individual_bonus_amount', 200);
  v_group_min_personal_sales := public.get_bonus_config_int('group_min_personal_sales', 2);
  v_group_target_sales := public.get_bonus_config_int('group_target_sales', 20);
  v_group_bonus_amount := public.get_bonus_config_numeric('group_bonus_amount', 300);

  for v_agent in
    select id
    from public.profiles
    where role = 'agent'
  loop
    v_personal_sales := public.agent_successful_sales_count_between(
      v_agent.id,
      v_start_ts,
      v_end_ts
    );

    v_group_sales := public.agent_group_successful_sales_count_between(
      v_agent.id,
      v_start_ts,
      v_end_ts
    );

    if v_personal_sales >= v_individual_min_sales
      and v_personal_sales >= v_individual_target_sales then
      insert into public.bonus_records (
        beneficiary_agent_id,
        bonus_type,
        period_year,
        period_month,
        personal_sales_count,
        group_sales_count,
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
        v_individual_bonus_amount,
        'pending'
      )
      on conflict (beneficiary_agent_id, bonus_type, period_year, period_month) do nothing;

      if found then
        v_created_individual := v_created_individual + 1;
      end if;
    end if;

    if v_personal_sales >= v_group_min_personal_sales
      and v_group_sales >= v_group_target_sales then
      insert into public.bonus_records (
        beneficiary_agent_id,
        bonus_type,
        period_year,
        period_month,
        personal_sales_count,
        group_sales_count,
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
      'created_group', v_created_group
    ),
    'Monthly bonus calculation'
  );

  return jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'created_individual', v_created_individual,
    'created_group', v_created_group
  );
end;
$$;
