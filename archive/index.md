# Antigravity Technical Logs

This repository contains the persistent history of architectural decisions, performance optimizations, and infrastructure hardening performed by **Antigravity** in collaboration with the engineering team.

## 📂 Repository Structure
- [Architectural Decision Records (ADRs)](./adr/) - Rationale behind critical system changes.
- [Session Summaries](./sessions/) - Chronological logs of session goals and outcomes.

## 🚀 Key Milestones

- **2026-03-28**: [Performance Hardening & v6.0 Resilience](./sessions/2026-03-28_Performance_Hardening.md)
  - Repaired `engineer_form` PostgreSQL attribute limit (1600 col fix).
  - Implemented `ph_migrations` state-aware tracking.
  - Deployed Zod schema validation layer.

- **2026-04-04**: [Permanent VM Hardening & Alignment](./sessions/2026-04-04_Permanent_VM_Hardening.md)
  - Established `ecosystem.config.cjs` as the permanent PM2 source of truth.
  - Hardened Production Nginx blocks with 600s timeouts and disabled buffering in `tmp_stride.conf`.
  - Refactored `forensic_heal.sh` for multi-site autonomy.
  - Implemented `heal:production` unified deployment workflow.

- **2026-04-11**: [Unit 8 Submission Fix & Error Diagnostics Overhaul](./sessions/2026-04-11_Unit8-Submission-Fix-and-Error-Panel.md)
  - Identified 5 root causes blocking Unit 8 form submission on certain devices.
  - Fixed `isStep3Valid()` ALL-fields gate → SUM > 0 (matched server-side logic).
  - Added `safeBoolean` Zod preprocessor for all 5 boolean fields.
  - Fixed JSONB boot migration USING clause (TEXT vs TEXT[] branch).
  - Replaced `alert()` error handling with structured inline diagnostic panel.
  - See [ADR-0014](./adr/ADR-0014-Unit8-Form-Submission-Hardening.md) for rules going forward.

- **2026-04-09**: [Dual-Database Discovery & School Completion Fix](./sessions/2026-04-09_Dual-Database-Discovery-and-Completion-Fix.md)
  - Discovered production and localhost were using **two different PostgreSQL databases** (local `insight_pooled` vs Azure `insightEd`).
  - All prior repair scripts had been targeting Azure while production read local — a complete split-brain.
  - Rewrote `updateSchoolTotalCompletion` to be pgBouncer-safe (removed `BEGIN/COMMIT`, reads authoritative `unit*` int flags).
  - Added `POST /api/admin/resync-completion` bulk repair endpoint; resynced 12,554 schools.
  - Resolved by unifying production to Azure PostgreSQL (ADR-0012). School 151006: 13% → 100%.

- **2026-04-08**: [Filter Normalization, Server Recovery & Nginx Hardening](./sessions/2026-04-08_Filter_Normalization_and_Infrastructure_Hardening.md)
  - Fixed division filter regex to handle `SDO-`, `SDO `, and `Division of ` prefixes (`[-\\s]+`).
  - Implemented prop-driven derivation pattern in `FilterDrawer.jsx` (ADR-0010).
  - Recovered staging from ENOSPC using targeted `api-only-deploy.tar.gz` strategy.
  - Deleted stale `stride-dashboard` PM2 process (was `npm start` error loop).
  - Applied Nginx concurrency optimization: 4096 workers, upstream keepalive pools, binary asset micro-cache (ADR-0011).
  - Created `diag_server.sh` and `check_nginx_concurrency.sh` operational scripts.

## 📋 Architecture Decision Records

| ADR | Title | Date |
|-----|-------|------|
| [ADR-0001](./adr/ADR-0001-Migration-Tracking-System.md) | Migration Tracking System | 2026-03-28 |
| [ADR-0002](./adr/ADR-0002-Zod-Validation-Layer.md) | Zod Validation Layer | 2026-03-28 |
| [ADR-0003](./adr/ADR-0003-Engineer-Form-Schema-Repair.md) | Engineer Form Schema Repair (1600 Column Limit) | 2026-03-28 |
| [ADR-0004](./adr/ADR-0004-Server-Lifecycle-Management.md) | Server Lifecycle Management | 2026-03-28 |
| [ADR-0005](./adr/ADR-0005-Frontend-State-Derivation-Patterns.md) | Frontend State Derivation Patterns | 2026-03-28 |
| [ADR-0006](./adr/ADR-0006-Legacy-Firebase-Decoupling.md) | Legacy Firebase Decoupling | 2026-03-28 |
| [ADR-0007](./adr/ADR-0007-PDF-Pipeline-Scratch-Directory.md) | PDF Pipeline Scratch Directory | 2026-04-04 |
| [ADR-0008](./adr/ADR-0008-Engineer-Upload-Postgres-Binary-Alignment.md) | Division Engineer Upload Postgres Binary Alignment | 2026-04-04 |
| [ADR-0009](./adr/ADR-0009-Permanent-Self-Healing-Infrastructure.md) | Permanent Self-Healing Infrastructure | 2026-04-04 |
| [ADR-0010](./adr/ADR-0010-Filter-Prop-Driven-Derivation-Pattern.md) | Filter Prop-Driven Derivation Pattern | 2026-04-08 |
| [ADR-0011](./adr/ADR-0011-Nginx-Concurrency-and-Asset-Micro-Cache.md) | Nginx Concurrency Optimization & Binary Asset Micro-Cache | 2026-04-08 |
| [ADR-0012](./adr/ADR-0012-Production-Database-Unification.md) | Production Database Unification — Azure as Single Source of Truth | 2026-04-09 |
| [ADR-0013](./adr/ADR-0013-DB-Lock-Cascade-Resolution.md) | DB Lock Cascade Resolution | 2026-04-09 |
| [ADR-0014](./adr/ADR-0014-Unit8-Form-Submission-Hardening.md) | Unit 8 Form Submission Hardening | 2026-04-11 |

---
*Maintained by Antigravity — InsightEd PWA Engineering Log*
