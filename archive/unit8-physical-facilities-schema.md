# Unit 8: Physical Facilities — Database Schema Reference

**Table:** `ph_schools` (aggregate snapshot)  
**Source:** `api/db_init.js` — migration block lines 1398–1412  
**Description:** Stores aggregate counts of school buildings by repair condition and IT device inventory. These are high-level dashboard-ready snapshots; per-building detail is captured in the Unit 7 satellite tables (`ph_buildings_inventory`, `facility_inventory`). Completed by the School Head.

---

## Building Condition Summary

Aggregate count of buildings by their assessed physical condition.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `bldg_count_good` | `INTEGER` | `0` | Number of school buildings in good/serviceable condition. |
| `bldg_count_minor_repair` | `INTEGER` | `0` | Number of buildings requiring minor repair. |
| `bldg_count_major_repair` | `INTEGER` | `0` | Number of buildings requiring major repair or rehabilitation. |

---

## IT Device Inventory

Aggregate device counts across the entire school.

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `it_laptop_total` | `INTEGER` | `0` | Total number of laptops available in the school. |
| `it_tablet_total` | `INTEGER` | `0` | Total number of tablets available. |
| `it_pc_total` | `INTEGER` | `0` | Total number of desktop PCs available. |
| `it_printer_total` | `INTEGER` | `0` | Total number of printers available. |
| `it_ecart_total` | `INTEGER` | `0` | Total number of E-CART (mobile learning cart) units available. |

---

## Unit Completion Tracking

| Column | PostgreSQL Type | Default | Description |
|--------|----------------|---------|-------------|
| `unit8` | `INTEGER` | `0` | Completion score / progress counter for Unit 8. |
| `unit8_completed` | `BOOLEAN` | `FALSE` | `TRUE` when the School Head has fully submitted Unit 8. |
| `unit8_updated_at` | `TIMESTAMPTZ` | — | Timestamp of the most recent Unit 8 save. |
