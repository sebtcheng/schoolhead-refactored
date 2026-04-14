# Fix: Engineering Workflow & Project Management Stabilization (v1.1)

The Division Engineer and Architect accounts currently experience UI instability (jumping project lists) and incomplete data persistence for procurement milestones. This plan addresses these by stabilizing the UI sorting, expanding the procurement wizard, and refining the history logging system.

## User Decisions (Finalized)

> [!IMPORTANT]
> **Primary Sorting Strategy**: Projects will be sorted by **Funding Year (Latest First)**. This ensures new funding cycles are at the top, while maintaining stability within the year group.
> 
> **Procurement Block**: Notice of Award, NTP, and Target Completion dates are now **BLOCKING** fields for BEFF projects. If missing, the system will show a warning and prevent the save operation.

## Proposed Changes

---

### 1. Frontend: UI Stability & Sorting

#### [MODIFY] [EngineerProjects.jsx](file:///c:/Users/KleinZebastianCatapa/Documents/INSIGHTEDCODES2026/src/modules/EngineerProjects.jsx)
- Update the `filteredProjects` memoization:
    - Change sort logic: Sort by `funding_year` (Numeric DESC), then by `schoolName` (Alphanumeric ASC).
    - This creates a stable, organized view that doesn't jump when the internal Database ID changes during updates.

---

### 2. Frontend: Enhanced Procurement Wizard

#### [MODIFY] [UpdateProjectWizard.jsx](file:///c:/Users/KleinZebastianCatapa/Documents/INSIGHTEDCODES2026/src/components/UpdateProjectWizard.jsx)
- **Expand Bidding Milestones**:
    - Add milestones: `Request for Quotation`, `Negotiation`, `Opening of Quotation`.
    - Map these to the corresponding database keys (`request_for_quotation`, `negotiation`, `opening_of_quotation`).
- **Implement Project Timeline Section**:
    - Add fields for `Notice to Proceed (NTP)`, `Construction Start Date`, and `Target Completion Date`.
    - **Conditional Visibility**: Hide these fields if `is_donated` is true.
- **Enforce Mandatory Validation**:
    - In `canProceedNext()`, block the "Save" action for BEFF projects if `contractId`, `dateNoticeOfAward`, `noticeToProceed`, or `targetCompletionDate` are missing.

---

### 3. Frontend: Refined Activity Logs

#### [MODIFY] [ProjectLogModal.jsx](file:///c:/Users/KleinZebastianCatapa/Documents/INSIGHTEDCODES2026/src/components/ProjectLogModal.jsx)
- **Separate Log Entries**: Update `generateSentences` to treat `procurement_status` changes and `status` (construction) changes as distinct list items.
- **Timestamp Formatting**: 
    - Display logs with full time context: `MMM DD, YYYY hh:mm A` (e.g., `Apr 14, 2026 08:39 AM`).
    - Standardize on Philippine Timezone formatting.

---

### 4. Backend: Data Persistence Mapping

#### [MODIFY] [api/index.js](file:///c:/Users/KleinZebastianCatapa/Documents/INSIGHTEDCODES2026/api/index.js)
- Ensure the `PUT /api/update-project/:id` route correctly maps the new milestones from the request body to the `insertValues` array.
- Verify that `funding_year` is being correctly utilized from the `oldData` if not explicitly changed.

## Verification Plan

### Manual Verification
1. **Sorting Check**: Update a project from 2024 and verify it stays within the 2024 group, sorted alphabetically.
2. **BEFF Blocking Check**: Attempt to save a BEFF project as "Procurement Complete" without an NTP date. Verify the warning appears and the save is blocked.
3. **Donated Check**: Open a "Donated" project and verify the timeline fields are absent.
4. **Log Check**: Open "Project Log" and verify the timestamps now show hours/minutes.
