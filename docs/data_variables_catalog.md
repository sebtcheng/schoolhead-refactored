# InsightEd Data Variables Catalog (School Head Forms)

This document provides an exhaustive list of all data variables collected from School Heads through the InsightEd Mobile PWA. These variables are used for school profiling, resource tracking, and data health scoring.

---

## 1. School Identity & Profile (`SchoolProfile.jsx`)
*Baseline identification and curricular configuration.*

| Variable Key | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `school_id` | Unique DepEd School ID (6 digits) | String | Read-only from Auth/Cache |
| `school_name` | Official name of the school | String | Read-only |
| `region` | DepEd Region (e.g., Region I) | String | Read-only |
| `division` | Schools Division Office (SDO) | String | Read-only |
| `district` | School District | String | Read-only |
| `location_type` | Urban vs. Rural classification | String | Dropdown |
| `curricular_offering` | Levels offered (Elementary, JHS, SHS, etc.) | String | Normalized string |
| `is_multigrade` | Flag for multigrade configuration | Boolean | Toggle |
| `has_sned` | Flag for Special Needs Education | Boolean | Toggle |
| `has_als` | Flag for Alternative Learning System | Boolean | Toggle |
| `latitude` / `longitude` | GPS coordinates for mapping | Number | Float |

---

## 2. School Head Information (`SchoolInformation.jsx`)
*Personal and professional details of the reporting School Head.*

| Variable Key | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `lastName` | Family name of School Head | String | PSI_CD lookup available |
| `firstName` | Given name of School Head | String | PSI_CD lookup available |
| `middleName` | Middle name of School Head | String | PSI_CD lookup available |
| `itemNumber` | PSI_CD / Personal Item Number | String | Used for GMIS lookup |
| `positionTitle` | Professional Rank (e.g., Principal II) | String | Select List |
| `dateHired` | Date of appointment to current post | Date | YYYY-MM-DD |

---

## 3. Physical Facilities (`PhysicalFacilities.jsx`)
*Classroom inventory and infrastructure status.*

| Variable Key | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `total_rooms` | Total number of classroom units | Integer | |
| `rooms_functional` | Rooms currently usable for instruction | Integer | |
| `rooms_needs_repair` | Rooms with minor/major damages | Integer | |
| `rooms_condemned` | Rooms unsafe for occupancy | Integer | |
| `makeshift_rooms` | Temporary learning spaces | Integer | |
| `non_instructional` | Admin offices, clinics, etc. | Integer | |

---

## 4. Enrolment Data (`Enrolment.jsx`)
*Current school year enrolment counts per grade level.*

| Variable Key | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `grade_kinder` | Total Kinder enrollees | Integer | |
| `grade_1` to `grade_10` | Enrolment per grade level | Integer | Separate keys for each |
| `abm_11` / `abm_12` | SHS Academic: ABM | Integer | Grade 11 & 12 |
| `stem_11` / `stem_12` | SHS Academic: STEM | Integer | Grade 11 & 12 |
| `humss_11` / `humss_12` | SHS Academic: HUMSS | Integer | Grade 11 & 12 |
| `gas_11` / `gas_12` | SHS Academic: GAS | Integer | Grade 11 & 12 |
| `tvl_ict_11/12` | SHS TVL: ICT | Integer | |
| `tvl_he_11/12` | SHS TVL: Home Economics | Integer | |
| `tvl_ia_11/12` | SHS TVL: Industrial Arts | Integer | |
| `tvl_afa_11/12` | SHS TVL: Agri-Fishery Arts | Integer | |
| `arts_11/12` | SHS Arts & Design | Integer | |
| `sports_11/12` | SHS Sports Track | Integer | |
| `aral_participants` | Learners in ARAL recovery program | Integer | |

---

## 5. Organized Classes (`OrganizedClasses.jsx`)
*Section counts and class size distribution.*

| Variable Key | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `sections_kinder` | Number of Kinder sections | Integer | |
| `sections_g1-12` | Sections per grade level | Integer | Keys: `sections_grade_1`, etc. |
| `sections_sned` | Sections for SNEd/SPED | Integer | |
| `cntLess_kinder-12` | Classes with size < 35 (ES) / < 40 (SS) | Integer | Distribution metrics |
| `cntWithin_kinder-12` | Classes with size 35-40 (ES) / 40-45 (SS) | Integer | Distribution metrics |
| `cntAbove_kinder-12` | Classes with size > 40 (ES) / > 45 (SS) | Integer | Distribution metrics |

---

## 6. Learner Statistics (`LearnerStatistics.jsx`)
*Demographic-specific grids (flattened JSONB state).*

| Variable Key Pattern | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `sned_ES/JHS/SHS` | Learners with Special Needs | Integer | Flattened grid keys |
| `disability_ES/JHS/SHS` | Learners with manifest disability | Integer | |
| `repeater_ES/JHS/SHS` | Grade level repeaters | Integer | |
| `als_ES/JHS/SHS` | ALS-K to 12 equivalent | Integer | |
| `muslim_ES/JHS/SHS` | Muslim learners (ALIVE) | Integer | |
| `ip_ES/JHS/SHS` | Indigenous Peoples learners | Integer | |
| `displaced_ES/JHS/SHS` | Internally displaced/transferred | Integer | |

---

## 7. Shifting & Modalities (`ShiftingModalities.jsx`)
*Learning delivery configurations.*

| Variable Key | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `shift_kinder-g12` | Shifting strategy per level | String | Single, Double, Triple Shift |
| `mode_kinder-g12` | Learning Delivery Mode | String | In-Person, Blended, Distance |
| `adm_mdl` | Use of Modular Distance Learning | Boolean | Emergency ADM flags |
| `adm_odl` | Use of Online Distance Learning | Boolean | Emergency ADM flags |
| `adm_tvi` | Use of TV/Radio Instruction | Boolean | Emergency ADM flags |
| `adm_blended` | Use of Blended ADM | Boolean | Emergency ADM flags |

---

## 8. School Resources (`SchoolResources.jsx`)
*Inventory of utilities, equipment, and sanitation.*

| Variable Key | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `res_water_source` | Primary water source | String | Dropdown |
| `res_electricity_source` | Primary power source | String | Dropdown |
| `res_buildable_space` | Flag for available land for expansion | String | Yes/No |
| `res_sci_labs` | Functional Science Laboratories | Integer | |
| `res_com_labs` | Functional Computer Laboratories | Integer | |
| `res_laptop_func/nonfunc`| ICT: Laptops (Working/Broken) | Integer | |
| `res_tv_func/nonfunc` | ICT: Smart TVs (Working/Broken) | Integer | |
| `res_printer_func/nonfunc`| ICT: Printers (Working/Broken) | Integer | |
| `res_desk_func/nonfunc` | Furniture: Desks (Working/Broken) | Integer | |
| `res_armchair_func/non` | Furniture: Armchairs (Working/Broken)| Integer | |
| `female_bowls_func/non` | Sanitation: Female Bowls | Integer | |
| `male_bowls_func/non` | Sanitation: Male Bowls/Urinals | Integer | |
| `pwd_bowls_func/non` | Sanitation: PWD-accessible bowls | Integer | |
| `seats_kinder-grade12` | Available seats per grade level | Integer | Total count per level |
| `spaces` | Array of buildable area coordinates | Array | JSONB: `{lat, lng, L, W, A}` |
| `ecartBatches` | List of E-Cart distributions | Array | JSONB objects |

---

## 9. School Location & Hazards (`SchoolLocation.jsx`)
*Terrain profile and emergency accessibility metrics.*

| Variable Key | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `transportation_modes` | Modes used to reach school | Array | Habal-habal, Boat, etc. |
| `public_transpo_availability`| Availability score (1-5) | Integer | 1: Rare, 5: Constant |
| `road_paved_pct` | Percentage of paved roads to school | Integer | 0-100% |
| `near_cliff_ravine` | Geographic hazard flag | Boolean | |
| `near_water` | Proximity to river/sea/lake | Boolean | |
| `water_proximity` | Specific water body distances | Array | `{type, distance_km}` |
| `hazards_experienced` | Encountered hazards (e.g. Landslides)| Array | Multi-select |
| `cellular_coverage` | Signal strength (None to Strong) | String | Select List |
| `emergency_response_mins`| Time to nearest Hospital | Number | Reference Point |
| `proximity_hospital_km` | Distance to nearest Hospital | Number | Reference Point |
| `proximity_sdo_km/mins` | Distance/Time to Division Office | Number | Reference Point |
| `proximity_muni_hall_km`| Distance to Municipal Hall | Number | Reference Point |
| `natural_calamities` | History of Typhoons/Floods/etc. | Array | Multi-select |
| `has_insurgency_threats`| Security/Conflict risk flag | Boolean | |

---

## Summary of Data Types & Storage
- **Atomic Fields:** Stored as standard column types (Integer, Varchar, Boolean).
- **Complex Grids:** `LearnerStatistics` and `OrganizedClasses` use flattened keys for easy SQL querying but map to complex UI grids.
- **JSONB Arrays:** `spaces`, `ecartBatches`, and `water_proximity` are stored as JSONB to accommodate variable-length list data.
- **Normalization:** Curricular offerings are normalized via `normalizeOffering` utility to ensure consistency across modules.
