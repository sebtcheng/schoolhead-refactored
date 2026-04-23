# Unit 2: Learners (Enrollment) — Database Schema Reference

**Table:** `ph_schools`  
**Source:** `api/db_init.js` — migration block lines 1165–1211  
**Description:** Records school enrollment figures broken down by grade level and sex, including SNED (Special Needs Education) learners and multigrade groupings. Completed by the School Head.

---

## Total Enrollment Summary

Aggregate enrollment figures across the entire school.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `total_enrollment` | `INTEGER` | `0` | Total number of enrolled learners across all grade levels. |
| `male_enrollment` | `INTEGER` | `0` | Total male learner count (legacy aggregate field). |
| `female_enrollment` | `INTEGER` | `0` | Total female learner count (legacy aggregate field). |
| `total_male` | `INTEGER` | `0` | Computed total male enrollment (canonical aggregate). |
| `total_female` | `INTEGER` | `0` | Computed total female enrollment (canonical aggregate). |

---

## Grade-Level Enrollment (Total per Level)

One column per grade level capturing total headcount (sex-disaggregated columns are in the next section).

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `enroll_kinder` | `INTEGER` | `0` | Total Kindergarten enrollment. |
| `enroll_g1` | `INTEGER` | `0` | Total Grade 1 enrollment. |
| `enroll_g2` | `INTEGER` | `0` | Total Grade 2 enrollment. |
| `enroll_g3` | `INTEGER` | `0` | Total Grade 3 enrollment. |
| `enroll_g4` | `INTEGER` | `0` | Total Grade 4 enrollment. |
| `enroll_g5` | `INTEGER` | `0` | Total Grade 5 enrollment. |
| `enroll_g6` | `INTEGER` | `0` | Total Grade 6 enrollment. |
| `enroll_g7` | `INTEGER` | `0` | Total Grade 7 enrollment. |
| `enroll_g8` | `INTEGER` | `0` | Total Grade 8 enrollment. |
| `enroll_g9` | `INTEGER` | `0` | Total Grade 9 enrollment. |
| `enroll_g10` | `INTEGER` | `0` | Total Grade 10 enrollment. |
| `enroll_g11` | `INTEGER` | `0` | Total Grade 11 (Senior High) enrollment. |
| `enroll_g12` | `INTEGER` | `0` | Total Grade 12 (Senior High) enrollment. |

---

## Sex-Disaggregated Enrollment (Male / Female per Level)

Paired male/female columns for every grade level, Kinder through Grade 12.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `kinder_male` | `INTEGER` | `0` | Male Kindergarten learners. |
| `kinder_female` | `INTEGER` | `0` | Female Kindergarten learners. |
| `g1_male` | `INTEGER` | `0` | Male Grade 1 learners. |
| `g1_female` | `INTEGER` | `0` | Female Grade 1 learners. |
| `g2_male` | `INTEGER` | `0` | Male Grade 2 learners. |
| `g2_female` | `INTEGER` | `0` | Female Grade 2 learners. |
| `g3_male` | `INTEGER` | `0` | Male Grade 3 learners. |
| `g3_female` | `INTEGER` | `0` | Female Grade 3 learners. |
| `g4_male` | `INTEGER` | `0` | Male Grade 4 learners. |
| `g4_female` | `INTEGER` | `0` | Female Grade 4 learners. |
| `g5_male` | `INTEGER` | `0` | Male Grade 5 learners. |
| `g5_female` | `INTEGER` | `0` | Female Grade 5 learners. |
| `g6_male` | `INTEGER` | `0` | Male Grade 6 learners. |
| `g6_female` | `INTEGER` | `0` | Female Grade 6 learners. |
| `g7_male` | `INTEGER` | `0` | Male Grade 7 learners. |
| `g7_female` | `INTEGER` | `0` | Female Grade 7 learners. |
| `g8_male` | `INTEGER` | `0` | Male Grade 8 learners. |
| `g8_female` | `INTEGER` | `0` | Female Grade 8 learners. |
| `g9_male` | `INTEGER` | `0` | Male Grade 9 learners. |
| `g9_female` | `INTEGER` | `0` | Female Grade 9 learners. |
| `g10_male` | `INTEGER` | `0` | Male Grade 10 learners. |
| `g10_female` | `INTEGER` | `0` | Female Grade 10 learners. |
| `g11_male` | `INTEGER` | `0` | Male Grade 11 learners. |
| `g11_female` | `INTEGER` | `0` | Female Grade 11 learners. |
| `g12_male` | `INTEGER` | `0` | Male Grade 12 learners. |
| `g12_female` | `INTEGER` | `0` | Female Grade 12 learners. |

---

## SNED (Special Needs Education) Learners

Enrollment figures for learners with special educational needs.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `sned_male` | `INTEGER` | `0` | Total male SNED learners across all levels. |
| `sned_female` | `INTEGER` | `0` | Total female SNED learners across all levels. |
| `sned_self_contained_count` | `INTEGER` | `0` | Number of SNED learners in self-contained (dedicated SPED) classes. |

---

## Multigrade Enrollment

Enrollment figures for schools that operate combined multigrade classes.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `multigrade_groupings_1` | `TEXT` | — | Label/name for the first multigrade class grouping (e.g., `Grades 1-2`). |
| `multigrade_groupings_2` | `TEXT` | — | Label/name for the second multigrade class grouping. |
| `multigrade_groupings_3` | `TEXT` | — | Label/name for the third multigrade class grouping. |
| `multigrade_enrollment_1` | `INTEGER` | `0` | Total enrollment in the first multigrade grouping. |
| `multigrade_enrollment_2` | `INTEGER` | `0` | Total enrollment in the second multigrade grouping. |
| `multigrade_enrollment_3` | `INTEGER` | `0` | Total enrollment in the third multigrade grouping. |

---

## Simplified / Legacy Fields

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit2_simplified_enrollment` | `TEXT` | — | JSON-serialized simplified enrollment snapshot used for backward-compatible display in summary dashboards. |

---

## Unit Completion Tracking

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit2` | `INTEGER` | `0` | Completion score / progress counter for Unit 2. |
| `unit2_completed` | `BOOLEAN` | `FALSE` | `TRUE` when the School Head has fully submitted Unit 2. |
| `unit2_updated_at` | `TIMESTAMPTZ` | — | Timestamp of the most recent Unit 2 save. |
