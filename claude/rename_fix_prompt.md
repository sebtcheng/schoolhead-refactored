# SYSTEM ROLE
You are an expert full-stack developer operating in a Node.js/PostgreSQL environment. Your goal is to write clean, modular, and highly performant code based on the following specifications.

# 🌌 THE VIBE & AESTHETIC
The vibe is **Bulletproof Enterprise Consistency**. When a location name changes at a high level (Region, Division, District), that change MUST propagate to every specialized lookup table and data-heavy table in the system. The user should never see a stale name in a dropdown or a report. We prioritize data integrity and completeness over raw speed in this administrative operation.

# 🛠️ TECH STACK & ARCHITECTURE
- **Frontend:** React (LocationManagement.jsx)
- **Backend:** Node.js Express (api/index.js)
- **Database:** PostgreSQL (Azure-hosted)
- **Key Patterns:** Transactional multi-table updates, exact matching with normalization.

# 📝 CORE REQUIREMENTS
1. Update `PUT /api/locations/rename` in `api/index.js` to handle nested table updates.
2. Synchronize renames across `all_locations`, `all_locations_district`, `schools_IERN`, `ph_schools`, `school_summary`, and `school_profiles`.
3. Handle quoted case-sensitive columns in `schools_IERN` (e.g., `"District"`).
4. Maintain a single database transaction for the entire operation.

# 🚀 STEP-BY-STEP EXECUTION PLAN
Please implement the feature by following these steps in strict order. Do not proceed to the next major step until all sub-steps are fully implemented and logically complete:

**Step 1: Environmental Validation**
- **1a:** Verify the columns of all target tables (`schools_IERN`, `ph_schools`, `school_summary`, `school_profiles`) using a diagnostic script.
- **1b:** Confirm the specific casing required for each table.

**Step 2: Logic Implementation in api/index.js**
- **2a:** Refactor the `/api/locations/rename` endpoint to wrap all updates in a `BEGIN...COMMIT` block.
- **2b:** Implement the update logic for `district` renames across the targeted tables.
- **2c:** Implement the update logic for `municipality` and `legislative_district` renames.

**Step 3: Verification & Integrity Check**
- **3a:** Run the `tmp/repro_rename_bug.py` script to ensure it now passes (propagates to `all_locations_district`).
- **3b:** Perform a manual rename via the UI and verify all dashboard aggregations match.

# 🐛 DIAGNOSTIC & DEBUGGING SCRIPT
Provide a script `tmp/verify_rename_integrity.py` that:
- Periodically checks for name mismatches between `all_locations` and `schools_IERN`.
- Logs any rows where the location hierarchy is broken.

# 🛑 CONSTRAINTS & GUARDRAILS
- DO NOT skip any of the specified tables; the user expects a "connected" update.
- DO NOT use unquoted names for columns in `schools_IERN`.
