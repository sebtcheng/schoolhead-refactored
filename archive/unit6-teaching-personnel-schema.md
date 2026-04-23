# Unit 6: Teaching Personnel — Database Schema Reference

**Table:** `ph_schools` (aggregate snapshot)  
**Source:** `api/db_init.js` — migration block lines 1358–1369  
**Description:** Stores a high-level snapshot of the teaching workforce assigned to the school, broken down by curriculum level. The full teacher roster with individual records is stored separately in the `teachers_list` table (not part of the `ph_schools` unit columns). Completed by the School Head.

---

## Teacher Headcount Snapshot

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `total_teachers_registered` | `INTEGER` | `0` | Total number of teachers currently registered and assigned to the school. |
| `total_teachers_kinder` | `INTEGER` | `0` | Teachers assigned to Kindergarten level. |
| `total_teachers_elementary` | `INTEGER` | `0` | Teachers assigned to Elementary level (Grades 1–6). |
| `total_teachers_jhs` | `INTEGER` | `0` | Teachers assigned to Junior High School level (Grades 7–10). |
| `total_teachers_shs` | `INTEGER` | `0` | Teachers assigned to Senior High School level (Grades 11–12). |

---

## Unit Completion Tracking

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit6` | `INTEGER` | `0` | Completion score / progress counter for Unit 6. |
| `unit6_completed` | `BOOLEAN` | `FALSE` | `TRUE` when the School Head has fully submitted Unit 6. |
| `unit6_updated_at` | `TIMESTAMPTZ` | — | Timestamp of the most recent Unit 6 save. |

---

## Related Table: `teachers_list`

The detailed roster of individual teachers (name, position, subject, etc.) is stored in a separate `teachers_list` table keyed by `school_id` / `iern`. The columns above are a denormalized aggregate snapshot for dashboard performance.
