# Travelling Agency Management System - Main Development Guide

Use this as the primary reference to resume development quickly.

## 1) Current State Snapshot

- Platform: Next.js + Supabase (Postgres/Auth/Storage)
- Core status: booking, wallet, commission, bonus, GL, and audit workflows implemented
- Security status: role-based API guards + RLS hardening migration prepared
- Test status: unit + API behavior tests with Vitest

## 2) Quick Resume Checklist

When you return to this project, do these first:

1. Pull latest code and run local app:
   - `npm install`
   - `npm run dev`
2. Validate environment:
   - `.env.local` has Supabase URL/anon key/service role key
3. Run tests:
   - `npm test`
4. Check DB migrations:
   - Ensure all migrations `0001` through `0014` are applied in Supabase
5. Login with admin user and open `/dashboard`

## 3) Applied Migration Map

Migrations are in `supabase/migrations`.

- `0001_v1_core_schema.sql`
  - core tables: packages, bookings, wallet, commissions, audit
- `0002_booking_deposit_flow.sql`
  - atomic booking create + deposit deduction + pending commission
- `0003_booking_verification_flow.sql`
  - booking verify + commission confirm
- `0004_booking_cancellation_flow.sql`
  - booking cancel + refund + commission cancel
- `0005_profiles_and_roles.sql`
  - profiles + roles + auth user trigger
- `0006_wallet_topup_flow.sql`
  - self wallet top-up
- `0007_admin_wallet_topup.sql`
  - admin top-up any user + reason
- `0008_commission_rules_v2.sql`
  - rule-driven normal/downline/recruitment commissions
- `0009_bonus_engine.sql`
  - monthly bonus engine (base)
- `0010_bonus_lifecycle_and_payout_batches.sql`
  - bonus lifecycle + payout batches
- `0011_bonus_targets_in_rm.sql`
  - dynamic RM thresholds for bonus eligibility
- `0012_rls_hardening.sql`
  - row-level security hardening policies
- `0013_gl_engine.sql`
  - GL assignment engine (qualified/fairness)
- `0014_gl_manual_override.sql`
  - manual GL override + audit trail

## 4) Core Business Flows (Implemented)

### Booking Flow

- Create booking with deposit:
  - Deposit rule:
    - package `< RM8000` -> RM300
    - package `>= RM8000` -> RM500
- Verify booking:
  - `deposit_paid -> verified`
  - commissions `pending -> confirmed`
- Cancel booking:
  - refund deposit to wallet
  - commissions `pending/confirmed -> cancelled`

### Wallet Flow

- Immutable ledger approach:
  - transactions + ledger entries
  - no direct balance overwrite
- Actions:
  - self top-up
  - admin top-up with reason
  - booking deduction
  - cancellation refund

### Commission Flow

- Types:
  - normal
  - downline (levels 1..5)
  - recruitment (eligibility gated)
- Status lifecycle:
  - `pending -> confirmed -> paid`
  - cancellation path to `cancelled`

### Bonus Flow

- Monthly calculation:
  - individual and group bonus
  - dynamic RM thresholds configurable by admin
- Lifecycle:
  - `pending -> confirmed -> paid`
- Payout batches:
  - batch metadata + linked bonus records

### GL Flow

- Auto assign:
  - qualified GL first (>=20 verified pax proxy in V1)
  - fairness fallback if no qualified GL
- Manual override:
  - admin selects GL + mandatory reason
  - tracked as `manual_override`

## 5) API Surface (Current)

### Booking

- `POST /api/bookings/create-with-deposit`
- `POST /api/bookings/verify`
- `POST /api/bookings/cancel`
- `GET /api/bookings/{bookingId}/trace`
- `GET /api/bookings`

### Packages

- `GET /api/packages`
- `POST /api/packages` (admin)

### Wallet

- `GET /api/wallets/me/summary`
- `POST /api/wallets/me/topup`
- `POST /api/wallets/admin/topup` (admin)

### Bonus

- `POST /api/bonuses/calculate-monthly` (admin)
- `POST /api/bonuses/confirm-period` (admin)
- `POST /api/bonuses/pay-period` (admin)
- `GET /api/bonuses` (admin)
- `GET /api/bonuses/rules` (admin)
- `PATCH /api/bonuses/rules` (admin)

### GL

- `POST /api/gl/assign` (admin)
- `POST /api/gl/manual-override` (admin)
- `GET /api/gl/assignments` (admin)

### Utility

- `GET /api/users` (admin)
- `GET /api/health/supabase`

## 6) Role Matrix (System Behavior)

- `superadmin/admin`
  - full operations: verify/cancel bookings, package management, bonus lifecycle, GL assign/override
- `agent`
  - create booking, view own data, self top-up
  - beneficiary is locked to self in UI
- `customer`
  - create own booking, self top-up, own data only

## 7) Testing and Quality

- Test runner: Vitest
- Commands:
  - `npm test`
  - `npm run test:watch`
- Current test coverage includes:
  - deposit rule invariants
  - wallet balance invariants
  - commission lifecycle transitions
  - API route behavior and auth checks (sample critical routes)

## 8) Deployment and Ops Notes

- Keep all sensitive business writes server-side (service-role APIs/RPC)
- Do not expose service role key to browser
- Ensure RLS migration (`0012`) is applied before production
- Enable monitoring on:
  - failed RPC/API calls
  - payout batch anomalies
  - wallet reconciliation discrepancies

## 9) Next Recommended Development Items

Priority order:

1. Expand automated tests:
   - payout edge cases, GL override edge cases, RLS behavior tests
2. Finance reconciliation views:
   - wallet/booking/commission/bonus cross-check dashboard
3. Reporting exports:
   - bonus payout CSV, GL assignment history CSV
4. Passenger model upgrade for true pax counting:
   - replace current verified-booking proxy for GL with passenger count
5. Production runbook:
   - backup, restore, incident and rollback procedures

## 10) Where to Edit What

- Business SQL logic: `supabase/migrations`
- API authorization and orchestration: `src/app/api`
- UI dashboard and admin controls: `src/app/dashboard/dashboard-client.tsx`
- Core server utilities: `src/server` and `src/lib/supabase`
- Main entry documentation: `README.md` + this guide
