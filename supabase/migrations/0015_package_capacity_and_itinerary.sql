-- Package itinerary, seat capacity, travel window, and booking cutoff.

alter table public.packages
  add column if not exists description text not null default '',
  add column if not exists seat_limit integer not null default 0
    constraint packages_seat_limit_non_negative check (seat_limit >= 0),
  add column if not exists travel_start_date date,
  add column if not exists travel_end_date date,
  add column if not exists booking_cutoff_date date;

alter table public.packages
  drop constraint if exists packages_travel_dates_order;

alter table public.packages
  add constraint packages_travel_dates_order check (
    travel_start_date is null
    or travel_end_date is null
    or travel_end_date >= travel_start_date
  );

comment on column public.packages.description is 'Itinerary and package details (often pasted by admin).';
comment on column public.packages.seat_limit is 'Max pax with deposit_paid or verified booking; 0 = unlimited.';
comment on column public.packages.booking_cutoff_date is 'Last date customers can book (inclusive).';

-- Enforce capacity, cutoff, and travel window when creating bookings.
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

  v_seat_limit int;
  v_booking_cutoff date;
  v_travel_end date;
  v_booked_count int;

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

  select price_rm, seat_limit, booking_cutoff_date, travel_end_date
  into v_total_amount, v_seat_limit, v_booking_cutoff, v_travel_end
  from public.packages
  where id = p_package_id
    and is_active = true;

  if v_total_amount is null then
    raise exception 'PACKAGE_NOT_FOUND_OR_INACTIVE';
  end if;

  if v_booking_cutoff is not null and current_date > v_booking_cutoff then
    raise exception 'PACKAGE_BOOKING_CLOSED';
  end if;

  if v_travel_end is not null and current_date > v_travel_end then
    raise exception 'PACKAGE_TRAVEL_ENDED';
  end if;

  if coalesce(v_seat_limit, 0) > 0 then
    select count(*)::int
    into v_booked_count
    from public.bookings
    where package_id = p_package_id
      and status in ('deposit_paid', 'verified');

    if v_booked_count >= v_seat_limit then
      raise exception 'PACKAGE_SOLD_OUT';
    end if;
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
