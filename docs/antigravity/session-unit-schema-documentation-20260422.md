---
session_date: 2026-04-22
type: Context Checkpoint / Session Summary
topic: Unit 1–10 Database Schema Documentation
---

# Session Summary: Unit 1–10 Schema Documentation

## What Was Done

Produced a complete set of database schema reference markdown files for all 10 School Head data collection units. These files document every column in `ph_schools` (and all satellite tables) organized by unit, grounded in the canonical migration block in `api/db_init.js` (lines 1113–1437) and verified against the modular component source files in `src/components/modular/`.

## Files Created

All files were saved to `docs/`:

| File | Unit | Tables |
|------|------|--------|
| `unit1-school-identity-schema.md` | Unit 1: School Identity | `ph_schools` |
| `unit2-learners-schema.md` | Unit 2: Learners (Enrollment) | `ph_schools` |
| `unit3-organized-classes-schema.md` | Unit 3: Organized Classes | `ph_schools` |
| `unit4-learner-profile-schema.md` | Unit 4: Learner Profile | `ph_schools` |
| `unit5-shifting-modality-schema.md` | Unit 5: Shifting & Modality | `ph_schools` |
| `unit6-teaching-personnel-schema.md` | Unit 6: Teaching Personnel | `ph_schools` |
| `unit7-school-resources-schema.md` | Unit 7: School Resources | `ph_schools`, `ph_buildings_repairs`, `ph_buildings_demolition`, `ph_buildings_inventory`, `facility_inventory`, `facility_rooms` |
| `unit8-physical-facilities-schema.md` | Unit 8: Physical Facilities | `ph_schools` |
| `unit9-school-location-terrain-schema.md` | Unit 9: School Location / Terrain | `ph_schools`, `school_location_profiles` |
| `unit10-verification-schema.md` | Unit 10: Verification | `ph_schools` (+ monitoring snapshot + index catalog) |

## Key Findings / Notes

- All unit data lives primarily in `ph_schools`, which acts as a wide denormalized table. Each unit has a corresponding `unit{n}`, `unit{n}_completed`, and `unit{n}_updated_at` triplet for tracking submission progress.
- **Unit 7** is the most complex: it has 6 tables total. `ph_buildings_*` tables are the legacy building condition pipeline; `facility_inventory` / `facility_rooms` are the modern replacement for new submissions.
- **Unit 9** uses a dedicated satellite table `school_location_profiles` (one row per school, keyed by `school_id`) for the full terrain/proximity assessment. Only a single computed column (`hazard_risk_score`) is written back to `ph_schools`.
- **Unit 4** has the highest column count (~100+) due to per-grade breakdowns across 8 learner group categories (ALS, Muslim, IP, Displaced, Overage, Dropout, Repeater, LWD) plus SNED and BMI.
- **Unit 1** has 10 form-only fields that exist in the React state (`Unit1SchoolIdentity.jsx`) but are not stored as independent columns — they are composed or resolved before the API write.
- The `completion_percentage`, `unit_completion`, and `forms_completed_count` columns (documented in Unit 10) are school-wide monitoring fields used by the HAWKEYE regional dashboard protocol.

## Source References

- `api/db_init.js` — canonical schema migrations (primary source)
- `src/components/modular/Unit1SchoolIdentity.jsx` — Unit 1 form state (used to identify form-only fields)
- `CLAUDE.md` — architecture overview (cross-reference for satellite table descriptions)
