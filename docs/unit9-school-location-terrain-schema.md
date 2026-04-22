# Unit 9: School Location / Terrain — Database Schema Reference

**Primary Table:** `ph_schools` (aggregate field)  
**Detail Table:** `school_location_profiles`  
**Source:** `api/db_init.js` — `ph_schools` migration block lines 1414–1421; `school_location_profiles` table lines 123–162  
**Description:** Documents the school's geographic context, terrain hazards, infrastructure accessibility, and proximity to essential services. The `ph_schools` table holds a single computed risk score; all detailed location attributes are in `school_location_profiles`. Completed by the School Head.

---

## `ph_schools` — Location Summary Column

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `hazard_risk_score` | `INTEGER` | `0` | Computed composite risk index derived from the full `school_location_profiles` assessment. Higher values indicate greater exposure to hazards. Calculated by `api/utils/safetyScore.js`. |

### Unit Completion Tracking

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit9` | `INTEGER` | `0` | Completion score / progress counter for Unit 9. |
| `unit9_completed` | `BOOLEAN` | `FALSE` | `TRUE` when the School Head has fully submitted Unit 9. |
| `unit9_updated_at` | `TIMESTAMPTZ` | — | Timestamp of the most recent Unit 9 save. |

---

## Detail Table: `school_location_profiles`

**Primary Key:** `school_id` (one row per school)

### Table Identity

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `school_id` | `TEXT` | — | **Primary Key.** References `ph_schools.school_id`. |
| `iern` | `TEXT` | — | IERN of the school. Denormalized for direct queries. |
| `updated_at` | `TIMESTAMP` | `CURRENT_TIMESTAMP` | Last update timestamp. |

### Road & Transportation Access

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `transportation_modes` | `JSONB` | `'[]'` | Array of available transportation modes to the school (e.g., `["Jeepney", "Tricycle"]`). |
| `road_paved_pct` | `NUMERIC` | — | Percentage of the access road that is paved. |
| `road_unpaved_pct` | `NUMERIC` | — | Percentage of the access road that is unpaved/gravel/dirt. |
| `road_lighting_pct` | `NUMERIC` | — | Percentage of the access road that has street lighting. |
| `road_passable_public_transpo_pct` | `NUMERIC` | — | Percentage of the road passable by public transportation. |
| `public_transpo_availability` | `INTEGER` | — | Availability rating of public transportation (e.g., scale 1–5). |
| `river_crossing_on_foot` | `BOOLEAN` | `FALSE` | `TRUE` if accessing the school requires crossing a river on foot. |
| `river_crossing_count` | `INTEGER` | `0` | Number of river crossings required to reach the school. |

### Terrain & Physical Hazard Proximity

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `near_cliff_ravine` | `BOOLEAN` | `FALSE` | `TRUE` if the school is located near a cliff or ravine. |
| `road_cliff_pct` | `NUMERIC` | — | Percentage of the access road that runs along a cliff or steep drop. |
| `near_water` | `BOOLEAN` | `FALSE` | `TRUE` if the school is located near a body of water (river, lake, sea). |
| `water_proximity` | `JSONB` | `'[]'` | Array describing proximity to specific water bodies (type, distance). |

### Natural Calamities & Hazard History

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `natural_calamities` | `JSONB` | `'[]'` | Array of natural calamity types the school has experienced (e.g., `["Flood", "Typhoon", "Earthquake"]`). |
| `hazards_experienced` | `JSONB` | `'[]'` | Detailed list of specific hazard events experienced by the school. |

### Security Threats

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `has_insurgency_threats` | `BOOLEAN` | `FALSE` | `TRUE` if the school area has experienced insurgency or armed conflict threats. |
| `insurgency_threats_6mo` | `INTEGER` | `0` | Number of insurgency/security incidents in the past 6 months. |
| `anthropogenic_threats` | `JSONB` | `'[]'` | Array of human-caused threats in the area (e.g., `["Mining", "Armed Groups"]`). |

### Proximity to Services

Travel time and distance to key services and facilities. All `_mins` columns are `NUMERIC` to support fractional minutes (e.g., `12.5` minutes). All `_km` columns are `NUMERIC` for decimal distances.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `emergency_response_mins` | `NUMERIC` | `0` | Average emergency response time to the school (minutes). |
| `proximity_hospital_km` | `NUMERIC` | `0` | Distance to the nearest hospital (km). |
| `proximity_brgy_hall_mins` | `NUMERIC` | `0` | Travel time to the nearest Barangay Hall (minutes). |
| `proximity_brgy_hall_km` | `NUMERIC` | `0` | Distance to the nearest Barangay Hall (km). |
| `proximity_muni_hall_mins` | `NUMERIC` | `0` | Travel time to the nearest Municipal/City Hall (minutes). |
| `proximity_muni_hall_km` | `NUMERIC` | `0` | Distance to the nearest Municipal/City Hall (km). |
| `proximity_sdo_mins` | `NUMERIC` | `0` | Travel time to the SDO (Schools Division Office) (minutes). |
| `proximity_sdo_km` | `NUMERIC` | `0` | Distance to the SDO (km). |
| `proximity_clinic_mins` | `NUMERIC` | `0` | Travel time to the nearest health clinic (minutes). |
| `proximity_clinic_km` | `NUMERIC` | `0` | Distance to the nearest health clinic (km). |
| `proximity_terminal_mins` | `NUMERIC` | `0` | Travel time to the nearest transport terminal (minutes). |
| `proximity_terminal_km` | `NUMERIC` | `0` | Distance to the nearest transport terminal (km). |
| `proximity_highway_mins` | `NUMERIC` | `0` | Travel time to the nearest highway (minutes). |
| `proximity_highway_km` | `NUMERIC` | `0` | Distance to the nearest highway (km). |

### Connectivity & Isolation

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `cellular_coverage` | `TEXT` | — | Cellular signal coverage level at the school (e.g., `Strong`, `Weak`, `None`). |
| `weather_isolation` | `BOOLEAN` | `FALSE` | `TRUE` if the school becomes inaccessible during certain weather conditions. |

### Computed Output

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `risk_index` | `TEXT` | — | Human-readable risk classification derived from the composite assessment (e.g., `Low`, `Moderate`, `High`, `Very High`). Mirrors the numeric `hazard_risk_score` in `ph_schools`. |
