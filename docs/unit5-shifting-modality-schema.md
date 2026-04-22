# Unit 5: Shifting & Modality — Database Schema Reference

**Table:** `ph_schools`  
**Source:** `api/db_init.js` — migration block lines 1326–1356  
**Description:** Records how classes are scheduled (single shift vs. shifting) and the delivery modality (face-to-face, online, blended, etc.) for each grade level. Completed by the School Head.

---

## Shifting Configuration

School-level flags describing the overall scheduling model.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `has_standard_shifting` | `BOOLEAN` | `FALSE` | `TRUE` if the school operates a standard double-shift schedule (AM/PM). |
| `shifting_modality` | `TEXT` | — | Free-text or structured description of the shifting arrangement (e.g., `"AM/PM"`, `"Tri-shift"`). |

---

## ADM (Alternative Delivery Mode) Flags

Boolean flags indicating which alternative delivery modes are offered by the school.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `adm_mdl` | `BOOLEAN` | `FALSE` | School offers Modular Distance Learning (MDL). |
| `adm_odl` | `BOOLEAN` | `FALSE` | School offers Online Distance Learning (ODL). |
| `adm_tvi` | `BOOLEAN` | `FALSE` | School offers TV/Radio-Based Instruction (TVI). |
| `adm_blended` | `BOOLEAN` | `FALSE` | School offers a Blended Learning approach. |

---

## Shift Assignment per Grade Level

The shift schedule assigned to each grade level. Values are typically `"AM"`, `"PM"`, `"Whole Day"`, or `null` if the grade is not offered.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `shift_kinder` | `TEXT` | — | Shift assignment for Kindergarten. |
| `shift_g1` – `shift_g12` | `TEXT` | — | Shift assignment per grade level, Grades 1 through 12. |
| `shift_mg_1` | `TEXT` | — | Shift assignment for the first multigrade grouping. |
| `shift_mg_2` | `TEXT` | — | Shift assignment for the second multigrade grouping. |
| `shift_mg_3` | `TEXT` | — | Shift assignment for the third multigrade grouping. |

---

## Delivery Mode per Grade Level

The learning modality used for each grade level (e.g., `"Face-to-Face"`, `"Blended"`, `"Modular"`).

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `mode_kinder` | `TEXT` | — | Delivery mode for Kindergarten. |
| `mode_g1` – `mode_g12` | `TEXT` | — | Delivery mode per grade level, Grades 1 through 12. |
| `mode_mg_1` | `TEXT` | — | Delivery mode for the first multigrade grouping. |
| `mode_mg_2` | `TEXT` | — | Delivery mode for the second multigrade grouping. |
| `mode_mg_3` | `TEXT` | — | Delivery mode for the third multigrade grouping. |

---

## Unit Completion Tracking

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit5` | `INTEGER` | `0` | Completion score / progress counter for Unit 5. |
| `unit5_completed` | `BOOLEAN` | `FALSE` | `TRUE` when the School Head has fully submitted Unit 5. |
| `unit5_updated_at` | `TIMESTAMPTZ` | — | Timestamp of the most recent Unit 5 save. |
