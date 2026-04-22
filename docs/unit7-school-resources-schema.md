# Unit 7: School Resources — Database Schema Reference

**Primary Table:** `ph_schools` (summary snapshot)  
**Satellite Tables:** `ph_buildings_repairs`, `ph_buildings_demolition`, `ph_buildings_inventory`, `facility_inventory`, `facility_rooms`  
**Source:** `api/db_init.js` — `ph_schools` migration block lines 1371–1396; satellite tables lines 35–102 and 1054–1103  
**Description:** Captures school resource data across four sub-domains: furniture, ICT equipment, WASH facilities, and utilities. Detailed building-level condition records are stored in the satellite tables. Completed by the School Head.

---

## `ph_schools` — Resource Snapshot Columns

### Furniture

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit7_furniture` | `TEXT` | — | JSON-serialized furniture inventory summary (chair/desk/table counts and conditions). |

### ICT Equipment

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit7_ict` | `TEXT` | — | JSON-serialized ICT inventory summary (device counts and types). |
| `u7_ict_smart_tv_cond` | `TEXT` | — | Condition rating for smart TV/display units (`Good`, `Needs Repair`, `For Disposal`). |
| `u7_ict_projector_cond` | `TEXT` | — | Condition rating for projectors. |
| `u7_ict_printer_cond` | `TEXT` | — | Condition rating for printers. |

### WASH (Water, Sanitation & Hygiene)

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit7_wash` | `TEXT` | — | JSON-serialized WASH facility summary (toilet/faucet counts). |
| `u7_wash_male_seats_cond` | `TEXT` | — | Condition of male toilet seats. |
| `u7_wash_female_seats_cond` | `TEXT` | — | Condition of female toilet seats. |
| `u7_wash_common_seats_cond` | `TEXT` | — | Condition of common/unisex toilet seats. |
| `u7_wash_pwd_seats_cond` | `TEXT` | — | Condition of PWD-accessible toilet seats. |
| `u7_wash_faucets_cond` | `TEXT` | — | Condition of hand-washing faucets. |
| `u7_confirm_no_piped` | `BOOLEAN` | `FALSE` | School Head confirmed there is no piped water connection. |
| `u7_confirm_zero_wash` | `BOOLEAN` | `FALSE` | School Head confirmed there are zero functional WASH facilities. |

### Utilities

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit7_utilities` | `TEXT` | — | JSON-serialized utility availability summary (electricity, water, internet). |
| `u7_confirm_no_grid` | `BOOLEAN` | `FALSE` | School Head confirmed there is no grid electricity connection. |
| `u7_confirm_no_wired` | `BOOLEAN` | `FALSE` | School Head confirmed there is no wired internet connection. |
| `u7_utility_internet_type` | `TEXT` | — | Type of internet connection available (e.g., `Fiber`, `LTE`, `Satellite`, `None`). |

### E-CART

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit7_has_ecart` | `BOOLEAN` | `FALSE` | `TRUE` if the school has at least one E-CART (mobile learning cart) unit. |
| `unit7_ecarts` | `TEXT` | — | JSON-serialized list of E-CART unit details. |

### Unit Completion Tracking

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit7` | `INTEGER` | `0` | Completion score / progress counter for Unit 7. |
| `unit7_completed` | `BOOLEAN` | `FALSE` | `TRUE` when the School Head has fully submitted Unit 7. |
| `unit7_updated_at` | `TIMESTAMPTZ` | — | Timestamp of the most recent Unit 7 save. |

---

## Satellite Table: `ph_buildings_repairs`

Stores per-room repair condition assessments for each building.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `id` | `SERIAL` | — | Primary key. |
| `school_id` | `VARCHAR(255)` | — | FK reference to `ph_schools.school_id`. |
| `iern` | `VARCHAR(255)` | — | FK reference to `ph_schools.iern`. |
| `building_name` | `TEXT` | — | Name or label of the building. |
| `room_name` | `TEXT` | — | Name of the specific room being assessed. |
| `item_name` | `TEXT` | — | Specific item/component assessed (e.g., `Roof`, `Floor`, `Walls`). |
| `oms` | `TEXT` | — | OMS (Operations and Maintenance System) classification code. |
| `condition` | `TEXT` | — | Condition rating (e.g., `Good`, `Minor Repair`, `Major Repair`). |
| `damage_ratio` | `INTEGER` | `0` | Estimated percentage of damage (0–100). |
| `recommended_action` | `TEXT` | — | Engineer-recommended remediation action. |
| `demo_justification` | `TEXT` | — | Justification text if demolition is recommended. |
| `remarks` | `TEXT` | — | Additional notes. |
| `created_at` | `TIMESTAMP` | `CURRENT_TIMESTAMP` | Record creation timestamp. |

---

## Satellite Table: `ph_buildings_demolition`

Stores demolition assessment records for buildings recommended for removal.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `id` | `SERIAL` | — | Primary key. |
| `school_id` | `VARCHAR(255)` | — | FK reference to `ph_schools.school_id`. |
| `iern` | `VARCHAR(255)` | — | FK reference to `ph_schools.iern`. |
| `building_name` | `TEXT` | — | Name or label of the building. |
| `room_name` | `TEXT` | — | Name of the room or section recommended for demolition. |
| `age` | `BOOLEAN` | `FALSE` | Demolition recommended due to building age. |
| `safety` | `BOOLEAN` | `FALSE` | Demolition recommended due to structural safety concerns. |
| `calamity` | `BOOLEAN` | `FALSE` | Demolition recommended due to calamity/disaster damage. |
| `upgrade` | `BOOLEAN` | `FALSE` | Demolition recommended to enable facility upgrade/replacement. |
| `less_than_7x9` | `INTEGER` | `0` | Number of rooms smaller than the 7×9m standard. |
| `"7x9"` | `INTEGER` | `0` | Number of rooms meeting the 7×9m standard. |
| `above_7x9` | `INTEGER` | `0` | Number of rooms exceeding the 7×9m standard. |
| `created_at` | `TIMESTAMP` | `CURRENT_TIMESTAMP` | Record creation timestamp. |

---

## Satellite Table: `ph_buildings_inventory`

Stores the full building inventory with status and usage details.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `id` | `SERIAL` | — | Primary key. |
| `school_id` | `VARCHAR(255)` | — | FK reference to `ph_schools.school_id`. |
| `iern` | `VARCHAR(255)` | — | FK reference to `ph_schools.iern`. |
| `building_name` | `TEXT` | — | Name or label of the building. |
| `room_name` | `TEXT` | — | Name of the room within the building. |
| `category` | `TEXT` | — | Building category (e.g., `Classroom`, `Admin`, `Laboratory`). |
| `storey` | `INTEGER` | `1` | Number of storeys in the building. |
| `classroom` | `INTEGER` | `1` | Number of classrooms in the building. |
| `year_completed` | `TEXT` | — | Year the building was completed/constructed. |
| `remarks` | `TEXT` | — | Additional notes about the building. |
| `less_than_7x9` | `INTEGER` | `0` | Rooms smaller than the 7×9m standard. |
| `"7x9"` | `INTEGER` | `0` | Rooms meeting the 7×9m standard. |
| `above_7x9` | `INTEGER` | `0` | Rooms exceeding the 7×9m standard. |
| `grade_level` | `TEXT` | — | Grade level(s) assigned to this building. |
| `advisory_teacher` | `TEXT` | — | Teacher assigned as adviser for the building/classroom. |
| `status` | `TEXT` | — | Current status (e.g., `In Use`, `Abandoned`, `Under Repair`). |
| `is_in_use` | `BOOLEAN` | `TRUE` | Whether the building is currently in active use. |
| `seats` | `TEXT` | — | Seat count or seating capacity description. |
| `created_at` | `TIMESTAMP` | `CURRENT_TIMESTAMP` | Record creation timestamp. |

---

## Satellite Table: `facility_inventory`

Modern facility inventory replacing the legacy `ph_buildings_inventory` flow for new submissions.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `id` | `SERIAL` | — | Primary key. |
| `school_id` | `TEXT` | — | FK reference to `ph_schools.school_id`. |
| `iern` | `TEXT` | — | FK reference to `ph_schools.iern`. |
| `building_name` | `TEXT` | — | Name or label of the building. `NOT NULL`. |
| `category` | `TEXT` | — | Building category. `NOT NULL`. |
| `status` | `TEXT` | — | Facility status. `NOT NULL`. |
| `no_of_storeys` | `INTEGER` | `1` | Number of storeys. |
| `no_of_classrooms` | `INTEGER` | — | Number of classrooms. `NOT NULL`. |
| `year_completed` | `INTEGER` | — | Year the facility was completed. |
| `remarks` | `TEXT` | — | Additional notes. |
| `grade_level` | `TEXT` | — | Grade level assigned to this facility. |
| `teacher_name` | `TEXT` | — | Advisory teacher for this facility. |
| `less_than_7x9` | `INTEGER` | `0` | Rooms below 7×9m standard. |
| `"7x9"` | `INTEGER` | `0` | Rooms meeting 7×9m standard. |
| `above_7x9` | `INTEGER` | `0` | Rooms exceeding 7×9m standard. |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | Record creation timestamp. |

**Index:** `idx_facility_inventory_iern` on `(iern)`.

---

## Satellite Table: `facility_rooms`

Individual room records nested under a `facility_inventory` building entry.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `room_id` | `SERIAL` | — | Primary key. |
| `building_id` | `INTEGER` | — | FK → `facility_inventory(id)` with `ON DELETE CASCADE`. |
| `school_id` | `TEXT` | — | Denormalized school reference for direct queries. |
| `room_name` | `TEXT` | — | Name of the room. `NOT NULL`. |
| `dimension` | `TEXT` | — | Room dimensions (e.g., `"7x9"`, `"6x8"`). |
| `grade_level` | `TEXT` | — | Grade level(s) using this room. |
| `advisory_teacher` | `TEXT` | — | Advisory teacher for this room. |
| `condition` | `TEXT` | — | Physical condition: `NEWLY BUILT`, `GOOD CONDITION`, or `REPAIR`. |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | Record creation timestamp. |

**Indexes:** `idx_facility_rooms_school_id` on `(school_id)`, `idx_facility_rooms_building_id` on `(building_id)`.
