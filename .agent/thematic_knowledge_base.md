# 🧠 InsightEd Thematic Knowledge Base

This document serves as the **Intelligent Clustering Engine** for InsightEd, as defined in [.agent/eye-of-horus.md](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/.agent/eye-of-horus.md). It organizes technical knowledge, root cause analyses (RCAs), and architectural decisions into a searchable, thematic hierarchy.

---

## 🏗️ Themes Index

- [Database](#database)
- [Infrastructure & DevOps](#infrastructure--devops)
- [UI/DOM & UX](#uidom--ux)
- [State Management & Data Flow](#state-management--data-flow)
- [Auth & Security](#auth--security)
- [Build & Config](#build--config)
- [Project-Specific (Unit 1-9)](#project-specific-unit-1-9)
- [Project-Specific (School Management)](#project-specific-school-management)

---

## Database

### 🔥 Aspect: Configuration Drift (P0 Pattern)
| Incident/Decision | Aspect | Complexity | Priority | Source | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Wrong DB name in .env** | Config Drift | High | P0 | [RCA-2026-04-16](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/antigravity/rca/2026-04-16_Total-Connectivity-Loss-Wrong-DB-Name.md) | `.env` had `insight_pooled` instead of `insightEd`. PgBouncer had no route for it → auth failure on every connection → 1000+ PM2 restart loops → zombie connections exhausted PgBouncer → 0 connections. **Correct URL:** `postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:6432/insightEd`. Run `fix_db_credentials.py` as first response to auth failures. |

### 🔥 Aspect: Boot-time Contention (P0 Pattern)
| Incident/Decision | Aspect | Complexity | Priority | Source | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Boot DDL Race Condition** | Startup Lock | High | P0 | [RCA-2026-04-16](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/antigravity/rca/2026-04-16_Boot-DDL-Lock-Contention-Fix.md) | `pg_try_advisory_lock` fails in PgBouncer tx mode — all workers acquired "the same" lock on different backends and ran DDL simultaneously. Fixed by gating all boot DDL behind `NODE_APP_INSTANCE === '0'`. `initFinanceDB`/`initMasterlistDB` must be inside this gate or they race. `SET lock_timeout` on pooled connections is forbidden — poisons the backend for future queries. |

### 🗃️ Aspect: Migration / Lifecycle
| Incident/Decision | Aspect | Complexity | Priority | Source | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Split-Brain Database Discovery** | Migration | High | P0 | [2026-04-09 Session](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/antigravity/sessions/2026-04-09_Dual-Database-Discovery-and-Completion-Fix.md) | Discovered localhost and production were targeting different PG databases. |
| **1600 Column Limit Fix** | Migration | High | P1 | [ADR-0003](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/antigravity/adr/ADR-0003-Engineer-Form-Schema-Repair.md) | Repaired `engineer_form` attribute limit in PostgreSQL. |
| **Project Count & Log Fix** | Logging | Medium | P2 | [fix_project_count_and_logs.md](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/claude/fix_project_count_and_logs.md) | Fixed 50-item limit and decoupled procurement logs. |
| **Automated School Registration** | Automation | Medium | P1 | [ADR-0004](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/ADR-004-Automated-School-Registration.md) | Implemented instant approval model with seq. IERN generation. |
| **School Identity Lifecycle** | Lifecycle | Medium | P1 | [ADR-0005](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/ADR-005-School-Conversion-Identity-Lifecycle.md) | Implemented archive-and-replace model for school ID changes. |
| **Registration Restructuring** | Restructuring | Medium | P1 | [registration_restructuring_plan.md](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/claude/registration_restructuring_plan.md) | Decoupled schools_IERN from ph_schools for cleaner registration. |
| **Location Table PK Fix** | Schema | Low | P2 | [RCA-2026-04-15](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/antigravity/rca/2026-04-15_Location-Table-Unique-Key-Fix.md) | Added `id SERIAL PRIMARY KEY` to location tables to fix DBeaver deletion error. |

### 🗄️ Aspect: Persistence
| Incident/Decision | Aspect | Complexity | Priority | Source | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Unit 8 Persistence Fix** | Persistence | Medium | P1 | [unit8_persistence_fix.txt](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/claude/unit8_persistence_fix.txt) | Fixed data loss during Unit 8 form submission. |
| **Unified Binary Storage** | Unified Storage | High | P1 | [postgres_binary_storage_documentation.md](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/claude/postgres_binary_storage_documentation.md) | Transitioned from VM disk to Postgres bytea blobs with WebP & SHA-256. |

---

## Infrastructure & DevOps

### 🚀 Aspect: Hardening / Optimization
| Incident/Decision | Aspect | Complexity | Priority | Source | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Nginx Concurrency Optimization** | Hardening | High | P1 | [ADR-0011](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/antigravity/adr/ADR-0011-Nginx-Concurrency-and-Asset-Micro-Cache.md) | Optimized for 4096 workers and upstream keepalive pools. |
| **Permanent VM Hardening** | Hardening | High | P1 | [2026-04-04 Session](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/antigravity/sessions/2026-04-04_Permanent_VM_Hardening.md) | Established PM2 source of truth and Nginx timeout hardening. |
| **External GIF Hosting** | Storage | Low | P1 | [ADR-0001](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/ADR-001-External-GIF-Hosting.md) | Offloaded heavy GIFs to external CDN to prevent ENOSPC. |
| **Unified Staging Recovery** | Hardening | Medium | P1 | [ADR-0002](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/ADR-002-Unified-Staging-Recovery.md) | Implemented nodes-based unified recovery and forensic healing. |
| **PostgreSQL Local Migration** | Migration | High | P1 | [ADR-0006](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/ADR-006-VM-Postgre%20Optimization%28April8%29.md) | Migrated DB to local loopback and 295GB dedicated disk. |
| **High-Concurrency Hardening** | Hardening | High | P1 | [ADR-0007](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/ADR-0007-High-Concurrency-Hardening-and-Transactional-Integrity.md) | Nginx tuning, Cortex load shedding, and WAL smoothing. |
| **Infrastructure Guardian** | Monitoring | Medium | P1 | [infrastructure_guardian.md](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/claude/infrastructure_guardian.md) | PM2 cluster tuning and traffic injection admission control. |
| **Azure Health Restoration** | Connectivity | Low | P1 | [azure_health_restoration_prompt.md](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/claude/azure_health_restoration_prompt.md) | Aligned Nginx health probes with Azure App Gateway probes. |

---

## Network / API

### 🌐 Aspect: Timeouts
| Incident/Decision | Aspect | Complexity | Priority | Source | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PDF Upload Timeout Hardening** | Timeouts | Medium | P1 | [ADR-0003](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/ADR-003-Timeout-Hardening-Staging.md) | Increased timeouts to 600s across Nginx and Node.js layers. |

### 📤 Aspect: Middleware / Uploads
| Incident/Decision | Aspect | Complexity | Priority | Source | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Project Edit Upload Fix** | Middleware | Medium | P2 | [doc_upload_failure_fix_plan.md](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/claude/doc_upload_failure_fix_plan.md) | Resolved multipart/form-data parsing issues by adding multer middleware. |

---

## State Management & Data Flow

### 🌊 Aspect: Data Integrity
| Incident/Decision | Aspect | Complexity | Priority | Source | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Unit 6 Stale Data Fix** | SSoT | Medium | P1 | [fix_unit6_stale_data.md](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/claude/fix_unit6_stale_data.md) | Implemented selective merge to prevent cache from overwriting fresh counts. |
| **IPC Media Persistence** | SSoT | Medium | P1 | [ipc_media_persistence_plan.md](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/claude/ipc_media_persistence_plan.md) | Pivoted asset association to IPC for 100% version-agnostic reliability. |

---

## Project-Specific (Unit 1-9)

### 🏬 Unit 7: Physical Facilities
| Incident/Decision | Aspect | Complexity | Priority | Source | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Building Collapse Fix** | Consistency | Medium | P1 | [unit7_building_collapse_fix.md](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/claude/unit7_building_collapse_fix.md) | Fixed race condition where multiple buildings merged during re-edit. |
| **Condemnation Scope Fix** | Stability | Low | P2 | [2026-04-15 Session](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/antigravity/sessions/2026-04-15_School-Management-UI-Refinement.md) | Resolved `ReferenceError` in `handleSaveBuilding` by consolidating status check variables. |
| **Repair Validation Fix** | Consistency | Medium | P1 | [RCA-2026-04-16](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/antigravity/rca/2026-04-16_Unit7-Repair-Validation-Fix.md) | Fixed room-building condition desync causing false validation errors. |

### 🌍 Unit 8/9: Location & Safety
| Incident/Decision | Aspect | Complexity | Priority | Source | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Unit 8 Validation Fix** | Integrity | Medium | P1 | [unit8_validation_fix_vibe.md](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/claude/unit8_validation_fix_vibe.md) | Robust UPSERT and Zod validation for school location profiles. |

---

---

## UI/DOM & UX

### 🎨 Aspect: Normalization
| Incident/Decision | Aspect | Complexity | Priority | Source | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Filter Prefix Normalization** | Normalization | Medium | P2 | [2026-04-08 Session](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/antigravity/sessions/2026-04-08_Filter_Normalization_and_Infrastructure_Hardening.md) | Fixed SDO/Division filter regex to handle various prefixes. |
| **UI Density Optimization** | Aesthetics | Medium | P2 | [2026-04-15 Session](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/antigravity/sessions/2026-04-15_School-Management-UI-Refinement.md) | Refined `ActionModal` and forms across Schools module for better mobile density. |

---

## Project-Specific (School Management)

### 🏫 Aspect: Access Control / Workflow
| Incident/Decision | Aspect | Complexity | Priority | Source | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Search-First Status Flow** | Access Control | Medium | P1 | [2026-04-15 Session](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/antigravity/sessions/2026-04-15_School-Management-UI-Refinement.md) | Implemented mandatory 6-digit ID search with jurisdictional enforcement (SDO/Division). |
| **Registration Form Stability** | Stability | Low | P2 | [2026-04-15 Session](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/docs/antigravity/sessions/2026-04-15_School-Management-UI-Refinement.md) | Fixed `handleSubmit` ReferenceError in registration modal. |

---

*(This is a living document. entries will be added as ingestion progresses.)*
