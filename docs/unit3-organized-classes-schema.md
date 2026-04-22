# Unit 3: Organized Classes — Database Schema Reference

**Table:** `ph_schools`  
**Source:** `api/db_init.js` — migration block lines 1213–1238  
**Description:** Records how classes are organized across grade levels, including section sizes for each grade and multigrade configurations. Completed by the School Head.

---

## Multigrade Configuration

Flags and summary data describing whether the school operates multigrade classes.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `has_multigrade` | `BOOLEAN` | `FALSE` | `TRUE` if the school operates at least one multigrade class. Drives conditional display of multigrade size fields. |
| `multigrade_sections_count` | `INTEGER` | `0` | Total number of multigrade sections across the school. |

---

## Class Sizes per Grade Level

Number of organized sections/classes for each grade level. Values are stored as `TEXT` to accommodate range entries (e.g., `"2-3"`) and free-text annotations alongside numeric counts.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `grade_kinder_size` | `TEXT` | — | Number of Kindergarten sections. |
| `grade_1_size` | `TEXT` | — | Number of Grade 1 sections. |
| `grade_2_size` | `TEXT` | — | Number of Grade 2 sections. |
| `grade_3_size` | `TEXT` | — | Number of Grade 3 sections. |
| `grade_4_size` | `TEXT` | — | Number of Grade 4 sections. |
| `grade_5_size` | `TEXT` | — | Number of Grade 5 sections. |
| `grade_6_size` | `TEXT` | — | Number of Grade 6 sections. |
| `grade_7_size` | `TEXT` | — | Number of Grade 7 sections. |
| `grade_8_size` | `TEXT` | — | Number of Grade 8 sections. |
| `grade_9_size` | `TEXT` | — | Number of Grade 9 sections. |
| `grade_10_size` | `TEXT` | — | Number of Grade 10 sections. |
| `grade_11_size` | `TEXT` | — | Number of Grade 11 sections. |
| `grade_12_size` | `TEXT` | — | Number of Grade 12 sections. |

---

## Multigrade Section Sizes

Section counts for each named multigrade grouping (parallel to the multigrade grouping labels captured in Unit 2).

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `multigrade_size_1` | `TEXT` | — | Number of sections for the first multigrade grouping (aligned to `multigrade_groupings_1` from Unit 2). |
| `multigrade_size_2` | `TEXT` | — | Number of sections for the second multigrade grouping. |
| `multigrade_size_3` | `TEXT` | — | Number of sections for the third multigrade grouping. |

---

## Simplified / Snapshot Field

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit3_simplified_counts` | `JSONB` | — | JSON snapshot of all grade-level section counts, used for fast read access in summary views without joining individual grade columns. Structure mirrors the `grade_*_size` columns. |

---

## Unit Completion Tracking

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit3` | `INTEGER` | `0` | Completion score / progress counter for Unit 3. |
| `unit3_completed` | `BOOLEAN` | `FALSE` | `TRUE` when the School Head has fully submitted Unit 3. |
| `unit3_updated_at` | `TIMESTAMPTZ` | — | Timestamp of the most recent Unit 3 save. |
