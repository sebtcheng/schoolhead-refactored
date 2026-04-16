### 🐛 Incident Report: Unit 7 Repair Validation Mismatch
**Date:** 2026-04-16 | **Status:** Resolved

**🏷️ Clustering Metadata:**
* **Theme:** Project-Specific (Unit 7) | **Aspect:** Consistency / Validation | **Complexity:** Medium | **Priority:** High

#### 1. The Problem & Symptom
* **Symptom**: User is unable to submit Unit 7 for school `103819`. The system alerts: `Validation Error: Please provide repair details for "sagES bldg 11 -1A" before finalizing.`
* **Context**: The user reports that the building "does not have repairs anymore", indicating they have updated the building status in the inventory but the system still thinks a room requires assessment.

#### 2. Root Cause Analysis (The "Why")
* **Underlying Flaw**: In `Unit7PhysicalFacilities.jsx`, the `handleSaveBuilding` function only forced rooms to the "Repair" or "Condemned" states. If a building was previously in "Repair" and then updated to "Good Condition", the constituent rooms remained in the "Repair" state because the logic preserved `r.condition`.
* **Desync**: This created a state where `roomsData` had rooms marked as `Repair` (triggering validation), but the building status was `Good`, leading to a confusing user experience where they were asked for repairs they just "removed" at the building level.

#### 3. The Final Fix
* **Implementation Summary**:
    - In `handleSaveBuilding`, added logic to force room conditions to `Good Condition` or `Newly Built` if the parent building is updated to those states.
    - Added an automatic cleanup of `repairAssessments` to remove entries for rooms that are no longer in the "Repair" state.
* **Key Code Changes**:
    - [Unit7PhysicalFacilities.jsx](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/src/components/modular/Unit7PhysicalFacilities.jsx)

#### 4. Observability & Resiliency
* **Resiliency**: The system now maintains strict state alignment between buildings and rooms.
* **Validation**: Future submission errors for Unit 7 will only occur if the data is genuinely missing, not due to stale state from previous edits.
