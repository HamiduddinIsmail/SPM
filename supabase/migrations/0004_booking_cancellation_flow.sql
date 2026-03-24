-- Cancellation flow:
-- booking: deposit_paid/verified -> cancelled
-- wallet: refund deposit
-- commissions: pending/confirmed -> cancelled

create or replace function public.cancel_booking_and_refund(
  p_booking_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_current_status text;
  v_booked_by_user_id uuid;
  v_deposit_amount numeric(12,2);
  v_wallet_account_id uuid;
  v_wallet_tx_id uuid;
  v_cancelled_commission_count int := 0;
  v_paid_commission_count int := 0;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  select
    status,
    booked_by_user_id,
    deposit_amount_rm
  into
    v_current_status,
    v_booked_by_user_id,
    v_deposit_amount
  from public.bookings
  where id = p_booking_id
  for update;

  if v_current_status is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_current_status = 'cancelled' then
    return jsonb_build_object(
      'booking_id', p_booking_id,
      'already_cancelled', true,
      'cancelled_commissions', 0
    );
  end if;

  if v_current_status not in ('deposit_paid', 'verified') then
    raise exception 'INVALID_BOOKING_STATUS_FOR_CANCELLATION';
  end if;

  select count(*)
  into v_paid_commission_count
  from public.commission_records
  where booking_id = p_booking_id
    and status = 'paid';

  if v_paid_commission_count > 0 then
    raise exception 'CANNOT_CANCEL_BOOKING_WITH_PAID_COMMISSIONS';
  end if;

  select id
  into v_wallet_account_id
  from public.wallet_accounts
  where owner_user_id = v_booked_by_user_id
  for update;

  if v_wallet_account_id is null then
    raise exception 'WALLET_ACCOUNT_NOT_FOUND';
  end if;

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
    'refund',
    p_idempotency_key,
    'booking',
    p_booking_id,
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
    'credit',
    v_deposit_amount
  );

  update public.bookings
  set
    status = 'cancelled'
  where id = p_booking_id;

  insert into public.booking_status_history (
    booking_id,
    from_status,
    to_status,
    changed_by_user_id
  )
  values (
    p_booking_id,
    v_current_status,
    'cancelled',
    p_actor_user_id
  );

  update public.commission_records
  set status = 'cancelled'
  where booking_id = p_booking_id
    and status in ('pending', 'confirmed');

  get diagnostics v_cancelled_commission_count = row_count;

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
    'booking.cancelled',
    'booking',
    p_booking_id,
    jsonb_build_object('status', v_current_status),
    jsonb_build_object(
      'status', 'cancelled',
      'refund_amount_rm', v_deposit_amount,
      'wallet_transaction_id', v_wallet_tx_id,
      'cancelled_commissions', v_cancelled_commission_count
    ),
    'Booking cancelled with wallet refund and commission cancellation'
  );

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'already_cancelled', false,
    'refund_amount_rm', v_deposit_amount,
    'cancelled_commissions', v_cancelled_commission_count
  );
end;
$$;
