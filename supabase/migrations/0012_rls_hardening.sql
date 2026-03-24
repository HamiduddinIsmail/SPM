-- RLS hardening for production safety.
-- Principle:
-- - Only server-side service-role paths perform sensitive writes.
-- - Authenticated users get least-privilege read access where needed.

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

-- Profiles
alter table public.profiles enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_app_role() in ('superadmin', 'admin')
);

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or public.current_app_role() in ('superadmin', 'admin')
)
with check (
  id = auth.uid()
  or public.current_app_role() in ('superadmin', 'admin')
);

-- Packages
alter table public.packages enable row level security;

drop policy if exists packages_select_authenticated on public.packages;
create policy packages_select_authenticated
on public.packages
for select
to authenticated
using (true);

drop policy if exists packages_write_admin_only on public.packages;
create policy packages_write_admin_only
on public.packages
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'admin'))
with check (public.current_app_role() in ('superadmin', 'admin'));

-- Bookings
alter table public.bookings enable row level security;

drop policy if exists bookings_select_owner_or_admin on public.bookings;
create policy bookings_select_owner_or_admin
on public.bookings
for select
to authenticated
using (
  booked_by_user_id = auth.uid()
  or public.current_app_role() in ('superadmin', 'admin')
);

-- Booking status history
alter table public.booking_status_history enable row level security;

drop policy if exists booking_status_history_select_owner_or_admin on public.booking_status_history;
create policy booking_status_history_select_owner_or_admin
on public.booking_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_status_history.booking_id
      and (
        b.booked_by_user_id = auth.uid()
        or public.current_app_role() in ('superadmin', 'admin')
      )
  )
);

-- Wallet accounts
alter table public.wallet_accounts enable row level security;

drop policy if exists wallet_accounts_select_owner_or_admin on public.wallet_accounts;
create policy wallet_accounts_select_owner_or_admin
on public.wallet_accounts
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or public.current_app_role() in ('superadmin', 'admin')
);

-- Wallet transactions
alter table public.wallet_transactions enable row level security;

drop policy if exists wallet_transactions_select_owner_or_admin on public.wallet_transactions;
create policy wallet_transactions_select_owner_or_admin
on public.wallet_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.wallet_accounts wa
    where wa.id = wallet_transactions.wallet_account_id
      and (
        wa.owner_user_id = auth.uid()
        or public.current_app_role() in ('superadmin', 'admin')
      )
  )
);

-- Wallet ledger entries
alter table public.wallet_ledger_entries enable row level security;

drop policy if exists wallet_ledger_entries_select_owner_or_admin on public.wallet_ledger_entries;
create policy wallet_ledger_entries_select_owner_or_admin
on public.wallet_ledger_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.wallet_accounts wa
    where wa.id = wallet_ledger_entries.wallet_account_id
      and (
        wa.owner_user_id = auth.uid()
        or public.current_app_role() in ('superadmin', 'admin')
      )
  )
);

-- Agent hierarchy
alter table public.agent_hierarchy enable row level security;

drop policy if exists agent_hierarchy_select_admin_only on public.agent_hierarchy;
create policy agent_hierarchy_select_admin_only
on public.agent_hierarchy
for select
to authenticated
using (public.current_app_role() in ('superadmin', 'admin'));

-- Commission records
alter table public.commission_records enable row level security;

drop policy if exists commission_records_select_beneficiary_or_admin on public.commission_records;
create policy commission_records_select_beneficiary_or_admin
on public.commission_records
for select
to authenticated
using (
  beneficiary_agent_id = auth.uid()
  or public.current_app_role() in ('superadmin', 'admin')
);

-- Bonus rule configs
alter table public.bonus_rule_configs enable row level security;

drop policy if exists bonus_rule_configs_select_admin_only on public.bonus_rule_configs;
create policy bonus_rule_configs_select_admin_only
on public.bonus_rule_configs
for select
to authenticated
using (public.current_app_role() in ('superadmin', 'admin'));

drop policy if exists bonus_rule_configs_write_admin_only on public.bonus_rule_configs;
create policy bonus_rule_configs_write_admin_only
on public.bonus_rule_configs
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'admin'))
with check (public.current_app_role() in ('superadmin', 'admin'));

-- Bonus records
alter table public.bonus_records enable row level security;

drop policy if exists bonus_records_select_beneficiary_or_admin on public.bonus_records;
create policy bonus_records_select_beneficiary_or_admin
on public.bonus_records
for select
to authenticated
using (
  beneficiary_agent_id = auth.uid()
  or public.current_app_role() in ('superadmin', 'admin')
);

-- Bonus payout batches
alter table public.bonus_payout_batches enable row level security;

drop policy if exists bonus_payout_batches_select_admin_only on public.bonus_payout_batches;
create policy bonus_payout_batches_select_admin_only
on public.bonus_payout_batches
for select
to authenticated
using (public.current_app_role() in ('superadmin', 'admin'));

-- Bonus status history
alter table public.bonus_status_history enable row level security;

drop policy if exists bonus_status_history_select_admin_only on public.bonus_status_history;
create policy bonus_status_history_select_admin_only
on public.bonus_status_history
for select
to authenticated
using (public.current_app_role() in ('superadmin', 'admin'));

-- Commission rule configs
alter table public.commission_rule_configs enable row level security;

drop policy if exists commission_rule_configs_select_admin_only on public.commission_rule_configs;
create policy commission_rule_configs_select_admin_only
on public.commission_rule_configs
for select
to authenticated
using (public.current_app_role() in ('superadmin', 'admin'));

drop policy if exists commission_rule_configs_write_admin_only on public.commission_rule_configs;
create policy commission_rule_configs_write_admin_only
on public.commission_rule_configs
for all
to authenticated
using (public.current_app_role() in ('superadmin', 'admin'))
with check (public.current_app_role() in ('superadmin', 'admin'));

-- Audit logs: admin-only visibility
alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_admin_only on public.audit_logs;
create policy audit_logs_select_admin_only
on public.audit_logs
for select
to authenticated
using (public.current_app_role() in ('superadmin', 'admin'));
