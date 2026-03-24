-- Admin top-up for any user with mandatory reason.

create or replace function public.admin_topup_wallet_for_user(
  p_owner_user_id uuid,
  p_actor_user_id uuid,
  p_amount_rm numeric,
  p_reason text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_wallet_account_id uuid;
  v_wallet_tx_id uuid;
  v_reason text;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  if p_amount_rm is null or p_amount_rm <= 0 then
    raise exception 'INVALID_TOPUP_AMOUNT';
  end if;

  if p_amount_rm > 100000 then
    raise exception 'TOPUP_LIMIT_EXCEEDED';
  end if;

  v_reason := trim(coalesce(p_reason, ''));
  if length(v_reason) = 0 then
    raise exception 'REASON_REQUIRED';
  end if;

  if length(v_reason) > 255 then
    raise exception 'REASON_TOO_LONG';
  end if;

  insert into public.wallet_accounts (owner_user_id, token_symbol)
  values (p_owner_user_id, 'RM_TOKEN')
  on conflict (owner_user_id) do nothing;

  select id
  into v_wallet_account_id
  from public.wallet_accounts
  where owner_user_id = p_owner_user_id
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
    'topup',
    p_idempotency_key,
    'admin_wallet_topup',
    p_owner_user_id,
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
    p_amount_rm
  );

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
    'wallet.admin_topup',
    'wallet_account',
    v_wallet_account_id,
    null,
    jsonb_build_object(
      'target_user_id', p_owner_user_id,
      'amount_rm', p_amount_rm,
      'wallet_transaction_id', v_wallet_tx_id
    ),
    v_reason
  );

  return jsonb_build_object(
    'target_user_id', p_owner_user_id,
    'wallet_account_id', v_wallet_account_id,
    'wallet_transaction_id', v_wallet_tx_id,
    'amount_rm', p_amount_rm,
    'reason', v_reason
  );
end;
$$;
