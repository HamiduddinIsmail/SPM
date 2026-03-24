-- V1 high-level schema baseline.
-- Keep financial records append-only wherever possible.

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  price_rm numeric(12,2) not null check (price_rm >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id),
  booked_by_user_id uuid not null,
  status text not null check (status in ('draft', 'deposit_pending', 'deposit_paid', 'verified', 'cancelled')),
  total_amount_rm numeric(12,2) not null check (total_amount_rm >= 0),
  deposit_amount_rm numeric(12,2) not null check (deposit_amount_rm in (300, 500)),
  verified_by_user_id uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique,
  token_symbol text not null default 'RM_TOKEN',
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_account_id uuid not null references public.wallet_accounts(id),
  transaction_type text not null check (transaction_type in ('topup', 'deduct', 'refund', 'adjustment')),
  idempotency_key text not null unique,
  reference_type text,
  reference_id uuid,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_transaction_id uuid not null references public.wallet_transactions(id),
  wallet_account_id uuid not null references public.wallet_accounts(id),
  direction text not null check (direction in ('credit', 'debit')),
  amount_rm numeric(12,2) not null check (amount_rm > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.agent_hierarchy (
  id uuid primary key default gen_random_uuid(),
  parent_agent_id uuid not null,
  child_agent_id uuid not null,
  level_depth int not null check (level_depth between 1 and 5),
  effective_from timestamptz not null default now(),
  effective_to timestamptz
);

create table if not exists public.commission_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  beneficiary_agent_id uuid not null,
  commission_type text not null check (commission_type in ('normal', 'recruitment', 'downline', 'bonus_individual', 'bonus_group')),
  hierarchy_level int check (hierarchy_level between 1 and 5),
  amount_rm numeric(12,2) not null check (amount_rm >= 0),
  status text not null check (status in ('pending', 'confirmed', 'paid', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);
