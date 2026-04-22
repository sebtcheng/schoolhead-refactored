# ADR-013: Integration of the "Regional Engineer" Role

## Status
Accepted / Pending Implementation (2026-04-22)

## Context

The InsightEd application manages school infrastructure projects through a hierarchy of engineer roles. Previously, "Division Engineers" were the primary field users, responsible for updating progress for projects within their specific jurisdiction.

A requirement emerged for a **Regional Engineer** role to provide higher-level oversight. This role needs to:
1. View projects across all divisions within their assigned region.
2. Have a dashboard interface identical to the Division Engineer for UI consistency.
3. Operate in a **Read-Only** capacity to prevent accidental or unauthorized updates to project data at the regional level.

## Decision

We will integrate the "Regional Engineer" role into the existing Role-Based Access Control (RBAC) system with the following architectural constraints:

### 1. Dashboard UI Synchronization
The `RegionalEngineerDashboard.jsx` will be redesigned to mirror `EngineerDashboard.jsx`. Instead of its current division-summary focus, it will utilize the standard project-status metrics (ABC, Contract, Active Projects, Delayed Projects) to provide a unified technical experience for all engineering tiers.

### 2. Jurisdiction-Based Oversight
The backend `/api/projects` endpoint will utilize the user's `region` claim from the JWT.
- For `Regional Engineer`, the API will filter solely by `region`, omitting the `division` column constraint used by Division Engineers.
- This enables a single dashboard view of the entire regional portfolio.

### 3. Read-Only Enforcement (UI Level)
Mutative actions will be gated in the following components:
- **[DetailedProjInfo.jsx](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/src/modules/DetailedProjInfo.jsx)**: The "Edit", "Variation", and "Upload/Replace Documents" buttons will be hidden for the 'Regional Engineer' role.
- **[EngineerProjects.jsx](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/src/modules/EngineerProjects.jsx)**: The `isUpdateLocked` logic will be explicitly enabled for this role, transforming "UPDATE" triggers into "LOCKED" indicators.
- **Creation Block**: The "Create Project" (Add Project) button will be hidden for Regional Engineers to prevent new record entry as part of the read-only mandate.

### 4. Registration Integration
The "Regional Engineer" role is added as a permanent option in the Engineer Portal registration flow. 

**Registration Specifications:**
- **Role Selection**: Users select "Regional Engineer" from the role dropdown.
- **Jurisdiction**: Upon selection, the system automatically hides the "Division" selection requirement. Users only need to select their assigned **Region**.
- **Security**: Regional Engineers use the same secure authorization code as Division Engineers (`E5T8-B2W3`) to streamline onboarding.
- **Account Category**: For internal reporting compatibility, these users are assigned the `accountCategory: 'DepEd Engineer'`.

## Rationale

- **Consistency**: Maintaining a shared layout between Division and Regional engineers reduces development overhead and ensures that documentation and training materials remain applicable to both.
- **Scalability**: Reusing the existing jurisdiction-filtering logic in `api/index.js` allows for regional oversight without introducing new database schemas or heavy aggregation layers.
- **Data Integrity**: Enforcing read-only access at the regional level ensures that project "Ground Truth" remains the responsibility of the Division Engineers while allowing the Region to perform auditing and monitoring.

## Consequences

### Pros
- Unified dashboard metrics across all engineering roles.
- Zero-latency regional oversight via optimized division-less SQL filtering.
- Minimal code footprint by leveraging existing `isUpdateLocked` and JWT claim patterns.

### Cons
- Regional Engineers cannot correct data directly even if errors are spotted; they must coordinate with Division Engineers (by design, to preserve accountability).
- Frontend gates must be maintained across multiple components (`DetailedProjInfo`, `EngineerProjects`) to ensure no edit leaks occur.

## Related Documentation
- Implementation Plan: [implementation_plan.md](file:///C:/Users/SebastianCheng/.gemini/antigravity/brain/fdc02786-96de-4031-a973-09ad1b4d37d1/implementation_plan.md)
- Task Tracker: [task.md](file:///C:/Users/SebastianCheng/.gemini/antigravity/brain/fdc02786-96de-4031-a973-09ad1b4d37d1/task.md)
