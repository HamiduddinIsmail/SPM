-- Commission Rules V2
-- Adds rule table and upgrades booking commission creation logic.

create table if not exists public.commission_rule_configs (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  percentage numeric(6,3) not null check (percentage >= 0 and percentage <= 100),
  is_active boolean not null default true,
  description text,
  updated_at timestamptz not null default now()
);

create or replace function public.set_commission_rule_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_commission_rule_configs_updated_at on public.commission_rule_configs;
create trigger trg_commission_rule_configs_updated_at
before update on public.commission_rule_configs
for each row
execute function public.set_commission_rule_updated_at();

insert into public.commission_rule_configs (rule_key, percentage, is_active, description)
values
  ('normal_sale', 10.0, true, 'Closing agent commission percentage on deposit'),
  ('downline_level_1', 5.0, true, 'Upline downline commission level 1'),
  ('downline_level_2', 3.0, true, 'Upline downline commission level 2'),
  ('downline_level_3', 2.0, true, 'Upline downline commission level 3'),
  ('downline_level_4', 1.0, true, 'Upline downline commission level 4'),
  ('downline_level_5', 1.0, true, 'Upline downline commission level 5'),
  ('recruitment', 5.0, true, 'Recruitment commission for direct sponsor')
on conflict (rule_key) do nothing;

create or replace function public.get_commission_percentage(
  p_rule_key text,
  p_default_percentage numeric
)
returns numeric
language plpgsql
as $$
declare
  v_percentage numeric;
begin
  select percentage
  into v_percentage
  from public.commission_rule_configs
  where rule_key = p_rule_key
    and is_active = true
  limit 1;

  return coalesce(v_percentage, p_default_percentage);
end;
$$;

create or replace function public.agent_successful_sales_count_for_month(
  p_agent_id uuid,
  p_reference_ts timestamptz
)
returns int
language plpgsql
as $$
declare
  v_start_month timestamptz;
  v_end_month timestamptz;
  v_count int;
begin
  v_start_month := date_trunc('month', p_reference_ts);
  v_end_month := v_start_month + interval '1 month';

  select count(distinct cr.booking_id)::int
  into v_count
  from public.commission_records cr
  join public.bookings b on b.id = cr.booking_id
  where cr.beneficiary_agent_id = p_agent_id
    and cr.commission_type = 'normal'
    and cr.status in ('confirmed', 'paid')
    and b.verified_at is not null
    and b.verified_at >= v_start_month
    and b.verified_at < v_end_month;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.create_booking_with_deposit(
  p_package_id uuid,
  p_booked_by_user_id uuid,
  p_actor_user_id uuid,
  p_beneficiary_agent_id uuid default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_booking_id uuid;
  v_wallet_account_id uuid;
  v_wallet_tx_id uuid;
  v_total_amount numeric(12,2);
  v_deposit_amount numeric(12,2);
  v_wallet_balance numeric(12,2);
  v_existing_booking_id uuid;

  v_normal_pct numeric;
  v_recruitment_pct numeric;
  v_downline_rule_key text;
  v_downline_pct numeric;
  v_direct_sponsor_id uuid;
  v_direct_sponsor_sales int;
  v_commission_amount numeric(12,2);
  v_now timestamptz := now();
  v_hierarchy record;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  select reference_id
  into v_existing_booking_id
  from public.wallet_transactions
  where idempotency_key = p_idempotency_key
    and reference_type = 'booking'
  limit 1;

  if v_existing_booking_id is not null then
    return v_existing_booking_id;
  end if;

  select price_rm
  into v_total_amount
  from public.packages
  where id = p_package_id
    and is_active = true;

  if v_total_amount is null then
    raise exception 'PACKAGE_NOT_FOUND_OR_INACTIVE';
  end if;

  v_deposit_amount := case
    when v_total_amount < 8000 then 300
    else 500
  end;

  select id
  into v_wallet_account_id
  from public.wallet_accounts
  where owner_user_id = p_booked_by_user_id
  for update;

  if v_wallet_account_id is null then
    raise exception 'WALLET_ACCOUNT_NOT_FOUND';
  end if;

  select coalesce(sum(case when direction = 'credit' then amount_rm else -amount_rm end), 0)
  into v_wallet_balance
  from public.wallet_ledger_entries
  where wallet_account_id = v_wallet_account_id;

  if v_wallet_balance < v_deposit_amount then
    raise exception 'INSUFFICIENT_WALLET_BALANCE';
  end if;

  insert into public.bookings (
    package_id,
    booked_by_user_id,
    status,
    total_amount_rm,
    deposit_amount_rm
  )
  values (
    p_package_id,
    p_booked_by_user_id,
    'deposit_paid',
    v_total_amount,
    v_deposit_amount
  )
  returning id into v_booking_id;

  insert into public.wallet_transactions (
    wallet_account_id,
    transaction_type,
    idempotency_key,
    reference_type,
    reference_id,
    created_by_user_id
  )
  values (
    v_wallet_account_id,
    'deduct',
    p_idempotency_key,
    'booking',
    v_booking_id,
    p_actor_user_id
  )
  returning id into v_wallet_tx_id;

  insert into public.wallet_ledger_entries (
    wallet_transaction_id,
    wallet_account_id,
    direction,
    amount_rm
  )
  values (
    v_wallet_tx_id,
    v_wallet_account_id,
    'debit',
    v_deposit_amount
  );

  if p_beneficiary_agent_id is not null then
    -- 1) Normal sale commission for closing agent.
    v_normal_pct := public.get_commission_percentage('normal_sale', 10.0);
    v_commission_amount := round(v_deposit_amount * (v_normal_pct / 100.0), 2);

    if v_commission_amount > 0 then
      insert into public.commission_records (
        booking_id,
        beneficiary_agent_id,
        commission_type,
        hierarchy_level,
        amount_rm,
        status
      )
      values (
        v_booking_id,
        p_beneficiary_agent_id,
        'normal',
        1,
        v_commission_amount,
        'pending'
      );
    end if;

    -- 2) Downline commissions for uplines, up to 5 levels.
    for v_hierarchy in
      select parent_agent_id, level_depth
      from public.agent_hierarchy
      where child_agent_id = p_beneficiary_agent_id
        and level_depth between 1 and 5
        and effective_from <= v_now
        and (effective_to is null or effective_to > v_now)
      order by level_depth asc
    loop
      v_downline_rule_key := 'downline_level_' || v_hierarchy.level_depth::text;
      v_downline_pct := public.get_commission_percentage(v_downline_rule_key, 0);
      v_commission_amount := round(v_deposit_amount * (v_downline_pct / 100.0), 2);

      if v_commission_amount > 0 then
        insert into public.commission_records (
          booking_id,
          beneficiary_agent_id,
          commission_type,
          hierarchy_level,
          amount_rm,
          status
        )
        values (
          v_booking_id,
          v_hierarchy.parent_agent_id,
          'downline',
          v_hierarchy.level_depth,
          v_commission_amount,
          'pending'
        );
      end if;
    end loop;

    -- 3) Recruitment commission for direct sponsor if eligibility is met.
    select parent_agent_id
    into v_direct_sponsor_id
    from public.agent_hierarchy
    where child_agent_id = p_beneficiary_agent_id
      and level_depth = 1
      and effective_from <= v_now
      and (effective_to is null or effective_to > v_now)
    order by effective_from desc
    limit 1;

    if v_direct_sponsor_id is not null then
      v_direct_sponsor_sales := public.agent_successful_sales_count_for_month(
        v_direct_sponsor_id,
        v_now
      );

      if v_direct_sponsor_sales >= 2 then
        v_recruitment_pct := public.get_commission_percentage('recruitment', 5.0);
        v_commission_amount := round(v_deposit_amount * (v_recruitment_pct / 100.0), 2);

        if v_commission_amount > 0 then
          insert into public.commission_records (
            booking_id,
            beneficiary_agent_id,
            commission_type,
            hierarchy_level,
            amount_rm,
            status
          )
          values (
            v_booking_id,
            v_direct_sponsor_id,
            'recruitment',
            1,
            v_commission_amount,
            'pending'
          );
        end if;
      end if;
    end if;
  end if;

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
    'booking.deposit_paid',
    'booking',
    v_booking_id,
    null,
    jsonb_build_object(
      'status', 'deposit_paid',
      'deposit_amount_rm', v_deposit_amount,
      'wallet_transaction_id', v_wallet_tx_id
    ),
    'Booking created with deposit deduction'
  );

  return v_booking_id;
end;
$$;
