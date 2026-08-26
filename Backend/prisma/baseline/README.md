# Production baseline gate

This directory intentionally contains no migration marked as applied.

The two historical migrations in `prisma/migrations` are valid for an empty
development database, but must not be replayed against an existing legacy or
production database. Before creating a production baseline:

1. Run `npm run db:inventory` and retain its checksum-protected artifact.
2. Run `npm run db:reconcile`; all error-severity checks must be zero.
3. Run `npm run db:drift:check`; exit code `0` is required.
4. Run `npm run db:baseline:draft` to generate DDL in the ignored `artifacts`
   directory. Review it against a schema-only dump from the real target.
5. Rehearse backup and restore on an anonymized clone.
6. Only an approved deployment runbook may execute `prisma migrate resolve`.

Generating a draft does not execute DDL and does not modify
`_prisma_migrations`. The production baseline remains blocked until the real
target database owner supplies a schema dump/clone and signs off the checksum.
