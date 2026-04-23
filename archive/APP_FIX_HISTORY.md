# InsightED Application Fix History

This document tracks technical improvements, bug fixes, and feature implementations made during development.

## 2026-04-23

### BEFF IPC Sync & Reconciliation Audit
- **Sync Check Development**: Created `scripts/check_missing_ipc_projects.cjs` to automate the identification of projects in `engineer_form` whose IPCs are missing from the master imported BEFF registry (`import_beff_projects_14-25_newcon`).
- **Discrepancy Identification**: Successfully isolated **251** projects in the engineer forms with valid IPCs that were not tracked in the official import tables.
- **Audit Logging**: Implemented a JSON-based audit export (`missing_ipc_projects.json`) for forensic tracing of unlinked infrastructure projects.


## 2026-04-08

### Infrastructure Migration & Optimization (STRIDE Transformation)

- **Local Database Migration**: Successfully migrated the PostgreSQL database from a remote Azure instance to a local environment on `STRIDE-PROD-VM-01`. This shift minimizes latency and prepares the infrastructure for 2,000+ concurrent users.
- **Dedicated Storage Partitioning**: Provisioned and mounted a 295GB managed disk at `/mnt` for application and database data, decoupling it from the 30GB OS partition.
- **PostgreSQL Performance Tuning**:
  - `shared_buffers`: Increased to 4GB (25% of 16GB RAM) for memory-resident inventory data.
  - `work_mem`: Scaled to 16MB for complex sorting/joins.
  - `effective_cache_size`: Set to 12GB to leverage OS-level caching.
- **Connection Pooling (PgBouncer)**: Implemented PgBouncer on port 6432 to handle thousands of concurrent student/teacher sessions via connection recycling, preventing "Too many connections" bottlenecks.
- **Storage Recovery**: Reclaimed 5GB+ of redundant DB files and 233MB of Nginx logs, reducing OS drive utilization from 100% to 84% and ensuring system stability.

## 2026-03-28

### HRODI Dashboard Visualization Fix

- **Category Normalization**: Implemented a `normalizeCategory` helper in `EFDHome.jsx` to map inconsistent database category names (e.g., "NEW CONSTRUCTION", "LMS", "REPAIR") to canonical frontend keys. This resolved the discrepancy where bar graph lengths did not match their numerical labels due to case-sensitivity and naming mismatches in Recharts.
- **Uncategorized Data Handling**: Added "Uncategorized" as a valid chart category to ensure all projects, even those with missing or unrecognized categories, are visually represented in the dashboard bars.

### Firebase Legacy Cleanup (Azure Migration Completion)

- **ReferenceError Resolution**: Fixed a critical `ReferenceError: admin is not defined` caused by removing the `firebase-admin` import while legacy initialization blocks were still active.
- **Surgical Decoupling**: Replaced the legacy Firebase Admin SDK import with a **Dummy Admin Object** at the top of `api/index.js`. This provides safe, non-functional fallbacks for all remaining `admin.auth()`, `admin.messaging()`, and `admin.apps` calls without breaking the application's routing or internal logic.
- **Redundant Logic Removal**: Excised legacy JIT migration code that attempted to fetch user records from Firebase Auth during school profile lookups.
- **FCM Neutralization**: Formally silenced Firebase Cloud Messaging (FCM) code in favor of future Azure-based notification systems, resolving console spam and execution errors.

## 2026-03-25

### Unit 7 Resource Audit Refinements

- **UI Taxonomy Update**: Removed "Discrepancy Detected" terminology from Unit 7 (School Resources) to reduce user anxiety. Relabeled confirmation prompts to "Status Confirmation" and "Resource Validation" while preserving the functional shortage/excess verification logic.
- **Robust Source-of-Truth Recovery**: Implemented a multi-layered data recovery strategy that cross-references JSON arrays with flat database columns (`enroll_g1`) and parses section counts from text descriptions (`grade_X_size`). This ensures Unit 7 reference data is always accurate even if some data sources are missing or inconsistent.
- **Aggressive Grade Detection**: Replaced strict curricular offering filters with a **Data-First** detection logic. Unit 7 now automatically identifies and includes any grade level that has recorded enrollment in Unit 2 or sections in Unit 3, regardless of the school's primary classification.
- **Multigrade Data Harvesting**: Robustly integrated the `has_multigrade` flag and implemented advanced **Multigrade Range Parsing**. Unit 7 now recognizes labels like "Grade 1-3" or "Kinder & Grade 1", correctly mapping all involved grade levels and summing their enrollment.
- **Draft Reconciliation**: Updated the `init` function to reconcile saved Unit 7 drafts with the latest school structure from Unit 3. This ensures that new multigrade groupings are reflected even if a previous draft existed, while preserving already verified furniture data.
- **Logical Row Sorting**: Implemented a custom sorting algorithm to ensure grade levels and multigrade groups appear in a natural academic order (Kinder → G1 → Multigrades → G12 → SPED/ALS).
- **Loading Hang Resolution**: Fixed a race condition/logic error in the `init` function that caused Unit 7 to hang on "Loading classrooms..." for new schools or schools with missing Unit 2 data.
- **Data Normalization**: Implemented strict JSON parsing for `unit2_simplified_enrollment` to ensure enrollment baselines are always accurate regardless of database storage format.
- **UI Cleanup (Confirmation Logic)**: Removed the school-wide "Status Confirmation" box and its associated requirement to type "confirm" at the bottom of the page. This streamlines the user experience by eliminating redundant global validations while preserving mandatory per-grade level validations within the audit modals.
- **Utility Status Confirmations**: Added dynamic, red-alert confirmation checkboxes for schools reporting a lack of grid electricity, piped water, or wired internet in Unit 7. These mandatory acknowledgments ensure data accuracy for critical infrastructure gaps.
- **Internet Type Granularity**: Introduced a new "Internet Connection Type" field (Wired, Wireless, Satellite) to Unit 7 Phase 5, providing better technical insights into school connectivity beyond simple Yes/No status.
- **SHA Classification Removal**: Removed the "School Classification (SHA)" question from Unit 7 Phase 5. This streamlines the data collection process by eliminating a redundant administrative field.
- **Unit 7 Navigation Correction**: Fixed a bug where completing Unit 7 would immediately redirect users to Unit 8. The application now correctly redirects to the **Modular Dashboard** (Units Overview).
- **Quantitative Asset Condition UI**: Standardized "Operational Condition" for all ICT and WASH assets (Smart TVs, Faucets, etc.) to use a "Working/Not Working" breakdown with auto-computation, matching the advanced desktop/laptop logic.
- **'Type Confirm' Validation**: Implemented mandatory "type confirm" text fields for critical utility status warnings (No Grid Power, No Piped Water, No Wired Internet). Users must now type the literal word "confirm" to validate these infrastructure gaps.
- **Infrastructure Schema Extensions**: Expanded the `ph_schools` table with 4 new columns (`u7_confirm_no_grid`, `u7_confirm_no_wired`, etc.) to permanently track these critical infrastructure confirmations and connection types for administrative reporting.

## 2026-03-24

### Strict Dynamic Grade Level Filtering

- **Issue**: Grade level fields in Units 2, 3, 7, and 8 were not strictly restricted based on the Unit 1 school classification (curricular offering), leading to potential data entry for non-applicable grades.
- **Fix**: Synchronized all modular units (2, 3, 7, and 8) to use a strict mapping rule based on the `curricular_offering` saved in the Azure Postgres database:
  - **Purely Elementary**: Kinder to Grade 6
  - **ES and JHS (K-10)**: Kinder to Grade 10
  - **Junior High and Senior High**: Grade 7 to Grade 12
  - **All Offering (K to 12)**: Kinder to Grade 12
  - **Purely Junior High School**: Grade 7 to Grade 10
  - **Purely Senior High School**: Grade 11 and Grade 12
- **Benefit**: Ensures data integrity by preventing users from entering data for grade levels not offered by their specific school classification.

## 2026-03-12

### Unit 6 Routing and Backend Alignment

- **Issue**: Mismatch between frontend unit numbering and backend API routes leading to data saving errors and navigation confusion.
- **Fixes**:
  - Aligned backend unit labels: **Unit 6** is now dedicated to **Teaching Personnel**, and **Unit 7** is dedicated to **Physical Resources/WASH/Utilities**.
  - Cleaned up `api/index.js` by removing redundant/incorrectly labeled routes (`PUT /api/ph_schools/unit6/:schoolId` for physical facilities).
  - Consolidated teacher roster API calls to use unified `ph_teachers_list` via `/api/ph_schools/:schoolId/teachers`.
  - Updated frontend components (`TeachingPersonnel.jsx`, `Unit6Summary.jsx`, `Unit7SchoolResources.jsx`) to point to correctly aligned endpoints.

### Unit 8 Refactoring and Building Status Integration

- **UX Improvement**: Simplified the Unit 8 wizard from 5 steps to **4 steps** by removing the separate demolition assessment page.
- **Implementation**:
  - Integrated **Building Status** (Newly Built, Good Condition, Repair, For Condemnation, Condemned) directly into the Building Registration modal (Step 2).
  - Dynamically display **Justifications for Condemnation/Demolition** checkboxes when a building is marked for condemnation.
  - Relocated the **Finalize Audit** section to Step 4 (Repair Assessment).
  - Cleaned up all legacy `demolitionRecords` state and logic to resolve potential ReferenceErrors and simplify data flow.

## 2026-03-11

### Bug Reporting System

- **Implementation**: Created a dedicated `bug_reports` table in the database and implemented a reporting API to allow users to document app issues directly from the chatbot.

### Contact Us Section

- **Fix**: Resolved an error preventing successful submission in the "Contact Us" feature.

## 2026-03-10

### Mobile Visualization Fixes

- **Issue**: Drill-down functionality in charts was failing on mobile devices.
- **Fix**: Implemented robust click/tap handlers for Plotly charts and reduced reliance on global variables to ensure consistent behavior across screen sizes.

### Chatbot Knowledge Migration

- **Implementation**: Migrated the chatbot FAQ database from a local JSON file to a PostgreSQL table with `pgvector` support for better search performance and scalability.

### Ollama VM Setup

- **Implementation**: Provisioned and configured an Azure VM (20.24.58.49) with Ollama to host AI models (`llama3`, `nomic-embed-text`) for localized chatbot intelligence.

- **Unit 5 Baseline Fix (Teacher Count)**: Fixed an issue where "Total Registered Teachers" in Unit 6 was displaying as 0. The system now calculates the baseline teacher headcount from the master list during Unit 5's finalization and includes a dynamic fallback in the school data fetching route.
- **Workload Metric Refactor (Weekly to Daily)**: Transitioned teacher workload tracking from "Weekly Capacity" to "Daily Teaching Load". Renamed UI labels in Unit 6 roster and summary pages, and adjusted the backend calculation to return a daily average for the school-wide workload metric.
- **Unit 6 Flow Consolidation**: Merged the "Finalize Roster" and "Submit" steps into a single "Finalize and Submit" action within the roster view. Removed the redundant Unit 6 Summary page, route, and component to streamline the user experience.
- **Unit 9 Navigation Refactor**: Replaced the icon-based stepper header in School Geography & Safety (Unit 9) with a sleek, horizontal progress bar and dynamic step labeling (e.g., "Step 1 of 5") to improve focus and visual clarity.
- **Unit 6 Conditional Completion**: Refined the Unit 6 finalization flow. Users can now proceed to Unit 7 even if some personnel have zero teaching load (Partial Submission), but the unit will remain as "Incomplete" on the dashboard and Roadmap until all workloads are fully assigned, ensuring data integrity without blocking progress.
- **Unit 8 Data Integrity**:
  - Refactored Building Detail inputs to strictly disallow leading zeros and enforce a minimum value of 1 for Storeys and Classrooms.
  - Implemented mandatory grade level selection in Step 3 (Granular Room Setup), blocking navigation until all rooms have an assigned grade level.
  - Fixed the Building Name dropdown in the Demolition form by refactoring from a `datalist` to a proper `select` element for better reliability.

### Super User Access Restructuring

- **UX Improvement**: Reorganized the Super User dashboard into "General Access" and "Infrastructure Monitoring" categories to improve navigation for administrative users.

### Response UI Refinement

- **Fix**: Resolved sticky column styling issues in the Information Database that caused data to be hidden on mobile screens.

## 2026-03-09

### Analytics Mobile View

- **UX Improvement**: Renamed tabs to "Graphical View" and "Table View" for better layout fit on mobile headers.
- **Optimization**: Condensed the header statistics display to reduce vertical clutter on small screens.
