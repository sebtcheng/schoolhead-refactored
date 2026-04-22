# Unit 10: Verification — Database Schema Reference

**Table:** `ph_schools`  
**Source:** `api/db_init.js` — migration block lines 1423–1429  
**Description:** The final unit in the School Head data collection flow. Unit 10 represents the School Head's formal verification and sign-off that all previously submitted unit data (Units 1–9) is accurate and complete. No additional data columns are collected beyond the completion tracking flags.

---

## Unit Completion Tracking

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit10` | `INTEGER` | `0` | Completion score / progress counter for Unit 10. Set to a non-zero value when the School Head confirms verification. |
| `unit10_completed` | `BOOLEAN` | `FALSE` | `TRUE` when the School Head has formally verified and submitted Unit 10. |
| `unit10_updated_at` | `TIMESTAMPTZ` | — | Timestamp of the Unit 10 verification submission. |

---

## Related: Overall Completion Monitoring Columns

These columns are added to `ph_schools` after all unit columns and track the school's aggregate submission progress across all 10 units. Source: `api/db_init.js` lines 1431–1437.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit_completion` | `NUMERIC` | `0` | Weighted completion score across all units (sum of individual `unit1`–`unit10` scores). |
| `forms_completed_count` | `INTEGER` | `0` | Count of units where `unit{n}_completed = TRUE`. Maximum value is 10. |
| `completion_percentage` | `NUMERIC` | `0` | Derived percentage: `(forms_completed_count / 10) * 100`. Used by dashboards and the HAWKEYE monitoring protocol. |

---

## Database Indexes on `ph_schools`

These indexes support the dashboard aggregation queries used across all units.

| Index Name | Columns | Type | Purpose |
|------------|---------|------|---------|
| `idx_ph_schools_school_id` | `(school_id)` | `UNIQUE` | Fast lookup by school login ID. |
| `idx_ph_schools_division` | `(division)` | Standard | SDO-scoped dashboard queries. |
| `idx_ph_schools_region` | `(region)` | Standard | Regional aggregation queries. |
| `idx_ph_schools_regional_summary` | `(region, division)` | Compound | HAWKEYE Protocol: regional dashboard summaries that group by both region and division simultaneously. |
