# Critical generated contracts

`critical-staff.openapi.json` is generated from the NestJS Zod/Swagger contract.
Run `npm run contract:generate` from `Backend/`; CI uses `contract:check` to fail on drift.

Slice 1H deliberately includes only current-session and audit-history paths. Expanding
this boundary requires a later business-slice decision, not an automatic full API migration.
