# Server Modules (V1)

This folder keeps backend domain logic isolated from UI code so we can later split
into a standalone NestJS service without rewriting business rules.

## Modules

- `booking`: Booking state machine and deposit validation.
- `wallet`: Immutable token ledger operations.
- `commission`: Commission lifecycle and eligibility checks.
- `hierarchy`: Upline/downline relationship rules.
- `audit`: Append-only audit event writer.

All financial decisions must be executed server-side.
