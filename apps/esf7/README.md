# ESF7 App Specification (Deferred Stub)

## Status
Deferred stub - currently operating via the shared database `esf7_link` table.

## Data Schema & Contracts
Table: `esf7_link`
Status Values: `SUBMITTED`, `PROCESSING`, `QUEUE`, `VERIFIED`

## Extraction Criteria
When ESF7 features expand beyond link status verification into a standalone portal:
1. Move ESF7 specific routes to `apps/esf7/api/`.
2. Move ESF7 frontend elements to `apps/esf7/web/`.
3. Link with `@shared/db`, `@shared/auth`, and `@shared/ui`.
