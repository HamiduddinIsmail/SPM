-- Admin verification flow:
-- booking: deposit_paid -> verified
-- commission: pending -> confirmed

create table if not exists public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  from_status text,
  to_status text not null,
  changed_by_user_id uuid not null,
  changed_at timestamptz not null default now()
);

create or replace function public.verify_booking_and_confirm_commissions(
  p_booking_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_current_status text;
  v_confirmed_count int := 0;
begin
  select status
  into v_current_status
  from public.bookings
  where id = p_booking_id
  for update;

  if v_current_status is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_current_status = 'cancelled' then
    raise exception 'BOOKING_CANCELLED';
  end if;

  if v_current_status = 'verified' then
    return jsonb_build_object(
      'booking_id', p_booking_id,
      'already_verified', true,
      'confirmed_commissions', 0
    );
  end if;

  if v_current_status <> 'deposit_paid' then
    raise exception 'INVALID_BOOKING_STATUS_FOR_VERIFICATION';
  end if;

  update public.bookings
  set
    status = 'verified',
    verified_by_user_id = p_actor_user_id,
    verified_at = now()
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
    'verified',
    p_actor_user_id
  );

  update public.commission_records
  set status = 'confirmed'
  where booking_id = p_booking_id
    and status = 'pending';

  get diagnostics v_confirmed_count = row_count;

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
    'booking.verified',
    'booking',
    p_booking_id,
    jsonb_build_object('status', v_current_status),
    jsonb_build_object(
      'status', 'verified',
      'confirmed_commissions', v_confirmed_count
    ),
    'Admin verified booking and confirmed pending commissions'
  );

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'already_verified', false,
    'confirmed_commissions', v_confirmed_count
  );
end;
$$;
