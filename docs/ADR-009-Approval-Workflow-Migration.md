# ADR 009: Decoupled Approval Workflow & Database Constraint Relaxation

* **Status:** Proposed
* **Date:** 2026-04-20
* **Deciders:** Antigravity (AI Assistant), Sebastian Cheng (User)
* **Consulted:** Avid Documenter Skill, Humanoid System Instructions

## Context and Problem Statement

The InsightEd Mobile PWA currently stores all engineering projects (Approved and Pending) in a single table: `engineer_form`. This causes the "Projects" tab for administrators (EFD/HRODI) to be cluttered with unvalidated submissions. 

The requirement is to move all projects with an `approval_status` of `'Pending'` to a separate referential table, `engineer_create`, which will serve as the source for the approval portal. 

However, moving these projects poses a risk of orphaning associated assets. Specifically, 160 photos (`engineer_image`) and 59 documents (`engineer_documents`) are currently linked to these pending projects via `project_id` foreign keys (FKs). Standard SQL `DELETE` operations on `engineer_form` are blocked by these referential integrity constraints.

## Decision Drivers

1.  **Workflow Separation:** Pending projects must not be visible in the primary inventory until approved.
2.  **Asset Integrity:** Photos and documents must remain perfectly linked to their respective projects during and after the migration.
3.  **Preservation of ID History:** The `project_id` must be preserved throughout the lifecycle to maintain historical tracking and foreign links.
4.  **Backend Complexity:** Re-pointing multiple foreign keys to different tables based on project state is architectural debt and prone to bugs.

## Considered Options

1.  **Keep all in `engineer_form` but hide by status:** Rejected because the user explicitly requested table-level separation for the approval portal.
2.  **Drop and Re-create FKs:** Drop the FK constraints on `engineer_image` etc., and re-create them as "Poly-FKs" pointing to both tables. (Not supported by PostgreSQL).
3.  **Constraint Relaxation (Chosen):** Drop the formal `FOREIGN KEY` constraints on tables linking to `project_id` (Images, Documents, Finance, HRODI refs) and replace them with database indexes.

## Decision Outcome

**Chosen Option: Option 3 (Constraint Relaxation).**

By relaxing the formal foreign key constraints, we allow a `project_id` to legally reside in either `engineer_form` or `engineer_create`. Because we are strictly preserving the `project_id` value during migration and subsequent approval transfers, the actual linkage in the data remains valid.

### Implementation Checklist

- [ ] Identify all 5 affected FK constraints (`engineer_image_project_id_fkey`, `engineer_documents_project_id_fkey`, etc.).
- [ ] DROP these formal constraints.
- [ ] Ensure non-unique indexes exist on `project_id` in all child tables for performance.
- [ ] Execute the migration: Copy Pending rows to `engineer_create` + Delete from `engineer_form`. (Preserving `project_id`).
- [ ] Update Backend API: Modify all endpoints (`update-project`, `upload-image`, `project-details`) to check both `engineer_form` and `engineer_create` if a project isn't found in the primary table.

## Consequences

*   **Good:** Separates the approval portal data cleanly from the production inventory.
*   **Good:** Zero risk of losing photos or documents for migrated projects.
*   **Good:** Simplifies the approval logic (Move row -> Change status -> Return to form).
*   **Neutral:** Integrity is now managed at the application level rather than strictly enforced by the database schema for these specific links. This is acceptable given the controlled nature of the project lifecycle.
