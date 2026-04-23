# Unit 4: Learner Profile — Database Schema Reference

**Table:** `ph_schools`  
**Source:** `api/db_init.js` — migration block lines 1240–1324  
**Description:** Captures disaggregated learner profile data beyond raw enrollment — BMI nutritional status, and per-grade counts across eight special learner group categories: ALS, Muslim, Indigenous Peoples (IP), Displaced, Overage, Dropout, Repeater, LWD, and SNED. Completed by the School Head.

---

## Selected Learner Groups (JSONB Selector)

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `selected_learner_groups` | `JSONB` | — | Array of learner group keys the school has reported data for (e.g., `["als", "ip", "sned"]`). Drives conditional display of per-group tables in the dashboard. |

---

## BMI / Nutritional Status

Aggregate nutritional status counts across the school population.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `bmi_severely_wasted` | `INTEGER` | `0` | Learners classified as Severely Wasted (BMI-for-age < -3 SD). |
| `bmi_wasted` | `INTEGER` | `0` | Learners classified as Wasted (BMI-for-age -3 to < -2 SD). |
| `bmi_overweight_obese` | `INTEGER` | `0` | Learners classified as Overweight or Obese (BMI-for-age > +1 SD). |
| `bmi_normal` | `INTEGER` | `0` | Learners with Normal nutritional status. |

---

## ALS (Alternative Learning System) Learners per Grade

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `als_kinder` | `INTEGER` | `0` | ALS learners in Kindergarten. |
| `als_g1` – `als_g12` | `INTEGER` | `0` | ALS learners per grade level, Grades 1 through 12. |
| `als_total` | `INTEGER` | `0` | Total ALS learners across all grade levels. |

---

## Muslim Learners per Grade

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `muslim_kinder` | `INTEGER` | `0` | Muslim learners in Kindergarten. |
| `muslim_g1` – `muslim_g12` | `INTEGER` | `0` | Muslim learners per grade level, Grades 1 through 12. |

---

## Indigenous Peoples (IP) Learners per Grade

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `ip_kinder` | `INTEGER` | `0` | IP learners in Kindergarten. |
| `ip_g1` – `ip_g12` | `INTEGER` | `0` | IP learners per grade level, Grades 1 through 12. |

---

## Displaced Learners per Grade

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `displaced_kinder` | `INTEGER` | `0` | Displaced learners in Kindergarten. |
| `displaced_g1` – `displaced_g12` | `INTEGER` | `0` | Displaced learners per grade level, Grades 1 through 12. |

---

## Overage Learners per Grade

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `overage_kinder` | `INTEGER` | `0` | Overage learners in Kindergarten. |
| `overage_g1` – `overage_g12` | `INTEGER` | `0` | Overage learners per grade level, Grades 1 through 12. |

---

## Dropout Learners per Grade

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `dropout_kinder` | `INTEGER` | `0` | Dropout learners in Kindergarten. |
| `dropout_g1` – `dropout_g12` | `INTEGER` | `0` | Dropout learners per grade level, Grades 1 through 12. |

---

## Repeater Learners per Grade

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `repeater_kinder` | `INTEGER` | `0` | Repeater learners in Kindergarten. |
| `repeater_g1` – `repeater_g12` | `INTEGER` | `0` | Repeater learners per grade level, Grades 1 through 12. |

---

## LWD (Learners with Disabilities) per Grade

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `lwd_kinder` | `INTEGER` | `0` | LWD learners in Kindergarten. |
| `lwd_g1` – `lwd_g12` | `INTEGER` | `0` | LWD learners per grade level, Grades 1 through 12. |

---

## SNED (Special Needs Education) Learners per Grade

Detailed per-grade SNED breakdown (complements the aggregate SNED totals captured in Unit 2).

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `sned_kinder` | `INTEGER` | `0` | SNED learners in Kindergarten. |
| `sned_g1` – `sned_g12` | `INTEGER` | `0` | SNED learners per grade level, Grades 1 through 12. |

---

## Unit Completion Tracking

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit4` | `INTEGER` | `0` | Completion score / progress counter for Unit 4. |
| `unit4_completed` | `BOOLEAN` | `FALSE` | `TRUE` when the School Head has fully submitted Unit 4. |
| `unit4_updated_at` | `TIMESTAMPTZ` | — | Timestamp of the most recent Unit 4 save. |

---

## Column Expansion Note

Each group's per-grade columns follow the pattern `{group}_kinder`, `{group}_g1` … `{group}_g12`. The full set of individual column names (e.g., `als_g1`, `als_g2`, …, `als_g12`) are defined inline in `api/db_init.js` lines 1249–1320. Condensed range notation is used above for readability.
