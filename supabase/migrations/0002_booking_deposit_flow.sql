-- Atomic booking + wallet deduction + pending commission + audit.

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
  v_commission_amount numeric(12,2);
  v_existing_booking_id uuid;
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
    -- V1 placeholder: 10% of deposit as pending normal commission.
    v_commission_amount := round(v_deposit_amount * 0.10, 2);

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
