# ADR-012: Unit Schema — Wide Denormalized Table with Satellite Detail Tables

## Status
Accepted / Implemented (2026-04-22)

## Context

InsightEd collects school data across 10 discrete units, each representing a distinct domain of the school's identity, enrollment, resources, and terrain. A structural decision had to be made on how to store this data in PostgreSQL.

Two competing approaches were considered:

1. **Normalized per-unit tables** — one table per unit (e.g., `unit1_school_identity`, `unit2_learners`, etc.), each keyed by `school_id` or `iern`.
2. **Wide denormalized table** — a single `ph_schools` table accumulating all unit columns, supplemented by satellite tables only where row-level detail is required.

The codebase grew organically toward Option 2, formalized in the canonical migration block in `api/db_init.js` (lines 1113–1437).

## Decision

**Use a single wide `ph_schools` table as the primary store for all unit data**, with satellite tables only for sub-entities that have a one-to-many relationship with the school (e.g., individual buildings, rooms, terrain proximity records).

### Table Topology

| Unit | Primary Store | Satellite Tables |
|------|--------------|-----------------|
| Unit 1: School Identity | `ph_schools` | `school_ownership_docs` |
| Unit 2: Learners | `ph_schools` | — |
| Unit 3: Organized Classes | `ph_schools` | — |
| Unit 4: Learner Profile | `ph_schools` | — |
| Unit 5: Shifting & Modality | `ph_schools` | — |
| Unit 6: Teaching Personnel | `ph_schools` | `teachers_list` (roster detail) |
| Unit 7: School Resources | `ph_schools` (snapshot) | `ph_buildings_repairs`, `ph_buildings_demolition`, `ph_buildings_inventory`, `facility_inventory`, `facility_rooms` |
| Unit 8: Physical Facilities | `ph_schools` | — |
| Unit 9: School Location / Terrain | `ph_schools` (risk score) | `school_location_profiles` |
| Unit 10: Verification | `ph_schools` | — |

### Completion Tracking Pattern

Every unit follows a consistent three-column tracking pattern on `ph_schools`:

```
unit{n}             INTEGER DEFAULT 0      -- progress score
unit{n}_completed   BOOLEAN DEFAULT FALSE  -- submission flag
unit{n}_updated_at  TIMESTAMPTZ            -- last save timestamp
```

Three additional aggregate columns are maintained at the school level:

```
unit_completion         NUMERIC   -- sum of all unit{n} scores
forms_completed_count   INTEGER   -- count of unit{n}_completed = TRUE
completion_percentage   NUMERIC   -- (forms_completed_count / 10) * 100
```

### Schema Migration Strategy

All columns are added via additive `ALTER TABLE … ADD COLUMN IF NOT EXISTS` statements inside `api/db_init.js`. There are no Knex migration files. This makes every migration idempotent and safe to re-run on server startup.

## Rationale

- **Dashboard performance**: All unit summary data for a school is retrieved in a single `SELECT` — no joins required for the primary monitoring views.
- **Offline sync simplicity**: The IndexedDB outbox (`pending_requests`, `modular_outbox`) serializes complete school snapshots. Merging these back into a single wide table is straightforward compared to multi-table upserts.
- **Additive migrations**: The `ADD COLUMN IF NOT EXISTS` pattern allows new fields to be introduced without downtime, rollback complexity, or migration file management.
- **Satellite tables only where necessary**: Buildings, rooms, and terrain proximity are one-to-many relationships — these genuinely require child tables and cannot be collapsed into columns.

## Consequences

### Pros
- Single-query reads for dashboard aggregation (HAWKEYE Protocol).
- Simple offline sync merge logic.
- Zero-downtime additive migrations on a live production database.
- Clear unit-by-unit column grouping makes schema navigation predictable.

### Cons
- `ph_schools` is a very wide table (~300+ columns). Unqualified `SELECT *` is expensive and should be avoided.
- Per-grade breakdowns for Unit 4 (Learner Profile) contribute ~100 columns alone due to 8 learner groups × 13 grade levels. Future units with similar granularity should consider JSONB aggregation (see `unit3_simplified_counts`, `unit2_simplified_enrollment` as precedents).
- No foreign key enforcement between `ph_schools` and most satellite tables — referential integrity is maintained by application logic and cleanup routines in `db_init.js`.

## Documentation Produced (2026-04-22)

As part of codifying this decision, full schema reference markdown files were generated for all 10 units and saved to `docs/`:

- `unit1-school-identity-schema.md`
- `unit2-learners-schema.md`
- `unit3-organized-classes-schema.md`
- `unit4-learner-profile-schema.md`
- `unit5-shifting-modality-schema.md`
- `unit6-teaching-personnel-schema.md`
- `unit7-school-resources-schema.md`
- `unit8-physical-facilities-schema.md`
- `unit9-school-location-terrain-schema.md`
- `unit10-verification-schema.md`

Session context checkpoint: `docs/antigravity/session-unit-schema-documentation-20260422.md`
