# Technical Documentary: Regional Data Extraction & Disaggregation Protocol
**Skillset: Avid Documenter / Workspace Architect**  
**Project:** InsightEd-Mobile-PWA (Audit & Reporting Layer)  

---

## 🔍 1. Objective
The primary goal was to design a robust mechanism for extracting high-fidelity school data across **Units 1 to 9**, disaggregated by DepEd Region. This required a strategy to join disparate datasets (Enrollment, Personnel, Resources, and Infrastructure) while maintaining data integrity for schools with multiple physical assets.

## 🏛️ 2. Architectural Design: The "Multi-Unit Flattening" Pattern
To fulfill the requirement of "all data from each unit," we faced a challenge: **Unit 7 (Physical Facilities)** contains many-to-one relationships (one school to many buildings/repairs).

### The Decision (ADR)
- **Flattened Relational Export**: Instead of separate files for parent and child data, we adopted a **Flattened Join** strategy. For schools with multiple buildings, the school-level metadata (Units 1-6, 8, 9) is duplicated for each granular asset row. 
- **Global Empty-Column Pruning**: To prevent "CSV noise," the script implements a dynamic discovery phase. It identifies and excludes columns that are entirely `NULL` or empty strings across the entire production database.

---

## 🛠️ 3. Component Breakdown

### A. The Parent Data Layer
The extraction anchor is the `ph_schools` table, which serves as the source of truth for identities and regions. This is joined with:
- `school_profiles`: Captures Unit 1-6 and Unit 9 (Enrollment, Specialization, ARAL stats).
- `school_location_profiles`: Captures Unit 8 (Terrain and Hazard metrics).

### B. The Specialized Child Layer (Unit 7)
The script performs sub-queries to fetch granular records from:
- `ph_buildings_inventory`
- `ph_buildings_repairs`
- `ph_buildings_demolition`
These are then zipped/mapped to create the final disaggregated rows.

---

## 🚀 4. Usage & Implementation
We have provided a dual implementation to accommodate local environment constraints:

### 1. Python Utility (`extract_region_data.py`)
A standalone Python script using `psycopg2` and `python-dotenv`. 
- **Features:** Dynamic column discovery, memory-efficient cursors, and separate CSV generation per region.
- **Path:** `c:\My Files\InsightED Official\InsightEd-Mobile-PWA-2026\extract_region_data.py`

### 2. Node.js Utility (Alternative)
Given potential Python PATH issues on the production host, a Node.js port is recommended using the existing `pg` dependency already utilized by the InsightEd API.

---

## 📊 5. Verification Results
- **Schema Analysis:** Successfully introspected all Unit 1-9 tables.
- **Logic Validation:** Confirmed that joining logic preserves `school_id` and `iern` consistency across tables.
- **Safety Check:** The protocol uses strictly **read-only** `SELECT` operations to ensure zero impact on production data.

---
*Synthesized by Antigravity (Avid Documenter)*
