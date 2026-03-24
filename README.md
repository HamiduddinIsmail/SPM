# Travelling Agency Management System (V1)

Supabase-first V1 scaffold focused on correctness for bookings, wallet ledger,
commissions, hierarchy, and auditability.

## Stack

- Next.js (App Router) + TypeScript
- Supabase Postgres/Auth/Storage
- Server-first domain modules in `src/server`

## Project Structure

- `src/server/modules/booking`: booking rules and lifecycle.
- `src/server/modules/wallet`: ledger invariants and wallet logic.
- `src/server/modules/commission`: commission state transitions.
- `supabase/migrations`: SQL schema for core V1 entities.

## Local Setup

1. Copy `.env.example` to `.env.local`
2. Fill Supabase keys
3. Install dependencies and start app:

```bash
npm install
npm run dev
```

4. Verify Supabase wiring:

```bash
curl http://localhost:3000/api/health/supabase
```

If `SUPABASE_SERVICE_ROLE_KEY` is empty, privileged admin operations are blocked by design.

## V1 Scope

- Package + booking management (including pax details)
- Deposit flow with rules:
  - `< RM8000`: RM300
  - `>= RM8000`: RM500
- Wallet token ledger (top-up, deduct, refund)
- Commission lifecycle (`pending -> confirmed -> paid/cancelled`)
- Audit logging for critical actions

## Next Build Steps

1. Implement admin verification and commission confirmation.
2. Add scheduled jobs for bonus and reconciliation.
3. Add downline and recruitment commission rules.
4. Add GL assignment and fairness selection logic.

## Implemented Endpoint (V1)

`POST /api/bookings/create-with-deposit`

Body:

```json
{
  "packageId": "uuid",
  "bookedByUserId": "uuid",
  "beneficiaryAgentId": "uuid-or-null",
  "idempotencyKey": "optional-string"
}
```

Behavior:

- Calls Postgres function `create_booking_with_deposit`.
- Validates package and wallet.
- Deducts deposit from wallet ledger.
- Creates booking in `deposit_paid` state.
- Creates pending normal commission when beneficiary agent is provided.
- Writes audit log entry.
- Uses authenticated Supabase user as actor (no `actorUserId` in payload).

Before testing this endpoint, run SQL migrations `0001` and `0002` in Supabase.

`POST /api/bookings/verify`

Body:

```json
{
  "bookingId": "uuid"
}
```

Behavior:

- Calls Postgres function `verify_booking_and_confirm_commissions`.
- Verifies booking transition (`deposit_paid -> verified`).
- Confirms all pending commissions for that booking (`pending -> confirmed`).
- Writes booking status history and audit log.
- Safe to retry: if already verified, returns `already_verified: true`.
- Restricted to `admin` and `superadmin` roles.

Before testing this endpoint, run SQL migration `0003` in Supabase.

`POST /api/bookings/cancel`

Body:

```json
{
  "bookingId": "uuid",
  "idempotencyKey": "optional-string"
}
```

Behavior:

- Calls Postgres function `cancel_booking_and_refund`.
- Cancels booking transition (`deposit_paid/verified -> cancelled`).
- Credits refund amount back to customer wallet ledger.
- Cancels all booking commissions in `pending/confirmed`.
- Blocks cancellation if any commission is already `paid`.
- Writes booking status history and audit log.
- Restricted to `admin` and `superadmin` roles.

Before testing this endpoint, run SQL migration `0004` in Supabase.

`GET /api/bookings/{bookingId}/trace`

Behavior:

- Returns one consolidated trace payload for operational debugging:
  - booking row
  - booking status history
  - commission records
  - wallet transactions linked to this booking
  - wallet ledger entries for those wallet transactions
  - booking audit logs

This endpoint is useful to validate full lifecycle transitions:
`create-with-deposit -> verify -> cancel`.

## Auth + Role Setup

Run SQL migration `0005_profiles_and_roles.sql` in Supabase.

- Adds `profiles` table linked to `auth.users`.
- New users are auto-assigned `customer` role.
- Booking APIs now enforce role checks using authenticated Supabase session.

To promote users for testing, run SQL like:

```sql
update public.profiles set role = 'admin' where id = '<USER_UUID>';
update public.profiles set role = 'agent' where id = '<USER_UUID>';
```

## User-Facing Pages (V1)

- `/login`: Email/password sign-in via Supabase Auth.
- `/dashboard`: Role-aware operations panel.
  - `agent/customer`: create booking with deposit.
  - `admin/superadmin`: verify booking, cancel booking with refund, trace booking.
  - all roles: wallet top-up action (self).

## Wallet Top-Up

- New migration: `0006_wallet_topup_flow.sql`
- New endpoint: `POST /api/wallets/me/topup`

Body:

```json
{
  "amountRm": 300
}
```

Behavior:

- Creates wallet account if missing.
- Inserts top-up wallet transaction + credit ledger entry.
- Writes audit log (`wallet.topup`).

## Admin Wallet Top-Up

- New migration: `0007_admin_wallet_topup.sql`
- New endpoint: `POST /api/wallets/admin/topup` (admin/superadmin only)
- New endpoint: `GET /api/users` (admin/superadmin only; for user picker)

Body:

```json
{
  "targetUserId": "uuid",
  "amountRm": 500,
  "reason": "manual adjustment for offline payment"
}
```

Behavior:

- Credits wallet for any target user.
- Requires a reason.
- Writes audit log action `wallet.admin_topup` with target user and amount.

## Commission Rules V2

- New migration: `0008_commission_rules_v2.sql`
- Adds rule table: `commission_rule_configs`
- Upgrades booking commission generation to:
  - normal sale commission for closing agent
  - downline commissions up to level 5 from `agent_hierarchy`
  - recruitment commission for direct sponsor (level 1 parent)

Recruitment eligibility:

- direct sponsor must have at least 2 successful sales in the same month
- successful sales are counted from verified bookings where sponsor has `normal` commission in `confirmed/paid`

Default percentage seeds:

- `normal_sale`: 10%
- `downline_level_1..5`: 5%, 3%, 2%, 1%, 1%
- `recruitment`: 5%

You can update percentages using SQL:

```sql
update public.commission_rule_configs
set percentage = 12.5
where rule_key = 'normal_sale';
```

## Bonus Engine V1

- New migration: `0009_bonus_engine.sql`
- New table: `bonus_records`
- New config table: `bonus_rule_configs`
- New endpoints:
  - `POST /api/bonuses/calculate-monthly` (admin/superadmin)
  - `GET /api/bonuses?year=YYYY&month=MM` (admin/superadmin)

Monthly calculation rules:

- Individual bonus:
  - personal successful sales >= `individual_min_sales`
  - personal successful sales >= `individual_target_sales`
- Group bonus:
  - personal successful sales >= `group_min_personal_sales`
  - group successful sales >= `group_target_sales`

Default bonus seeds:

- `individual_min_sales`: 2
- `individual_target_sales`: 5
- `individual_bonus_amount`: RM200
- `group_min_personal_sales`: 2
- `group_target_sales`: 20
- `group_bonus_amount`: RM300

## Bonus Lifecycle + Payout Batches

- New migration: `0010_bonus_lifecycle_and_payout_batches.sql`
- New tables:
  - `bonus_status_history`
  - `bonus_payout_batches`
- `bonus_records` extended with:
  - `confirmed_by_user_id`, `confirmed_at`
  - `paid_by_user_id`, `paid_at`
  - `payout_batch_id`
- New endpoints (admin/superadmin):
  - `POST /api/bonuses/confirm-period`
  - `POST /api/bonuses/pay-period`

Lifecycle flow:

- `pending -> confirmed` via confirm-period action
- `confirmed -> paid` via pay-period action
- pay action creates payout batch ID and links paid bonus records

## Dynamic Bonus RM Thresholds (Admin)

- New migration: `0011_bonus_targets_in_rm.sql`
- Bonus target thresholds now use RM values:
  - `individual_target_rm`
  - `group_target_rm`
- Bonus payout amounts are also admin-configurable:
  - `individual_bonus_amount`
  - `group_bonus_amount`
- New admin endpoint:
  - `GET /api/bonuses/rules`
  - `PATCH /api/bonuses/rules`
- Dashboard includes editable bonus threshold form.

## RLS Hardening

- New migration: `0012_rls_hardening.sql`
- Enables row-level security on core tables.
- Applies least-privilege policies:
  - owner/self access where relevant
  - admin/superadmin privileged visibility
  - no direct sensitive write paths for regular users

Important:

- Core financial writes are still executed through server-side RPC/API using service role.

## GL Engine V1

- New migration: `0013_gl_engine.sql`
- Adds:
  - `group_leader_assignments`
  - `agent_travel_history`
  - `bookings.group_leader_agent_id`
- New RPC:
  - `assign_group_leader_for_booking(booking_id, actor_user_id)`
- New admin endpoints:
  - `POST /api/gl/assign`
  - `GET /api/gl/assignments`

Assignment logic:

- Prefer qualified agents (>=20 verified pax proxy in V1).
- If none, fallback fairness selection:
  - never-travelled first
  - then least prior GL assignments.

## GL Manual Override

- New migration: `0014_gl_manual_override.sql`
- New endpoint:
  - `POST /api/gl/manual-override` (admin/superadmin)

Body:

```json
{
  "bookingId": "uuid",
  "groupLeaderAgentId": "uuid",
  "reason": "manual override reason"
}
```

Behavior:

- Forces booking GL to selected agent.
- Upserts `group_leader_assignments` with `assignment_type = manual_override`.
- Writes full audit log (`gl.manual_override`) including previous GL and reason.
