# Operational Readiness & Compliance: The Output

This document contains the official SOPs, user guides, and compliance protocols for field operations and administrative oversight.

## 1. Division Engineer Protocol
Division Engineers are responsible for on-site infrastructure tracking and verification.
- **Project Updates**: Must include accomplishment %, status (Ongoing/Completed), and mandatory categorized photos.
- **Evidence Requirements**: COA-compliant **Internal** (structural) and **External** (facade) photos are required for all progress updates.
- **App Installation**: InsightEd is a Progressive Web App (PWA) accessed via `tinyurl.com/InsightEdV2` and "Added to Home Screen."

## 2. School Head Reporting & "100% Data Health"
School Heads are the primary data providers, mandated to achieve a high Data Health Score.
- **Modular Reporting**: Data entry is split into 10 Units (Identity, Learners, Resources, etc.).
- **Scoring Engine**: Submissions are computationally evaluated nightly. Points are deducted for missing data, consistency mismatches, and statistical outliers.
- **Excellent Tier (100)**: No issues detected; all sub-totals match; actualFacilities justify enrollment ratios.

## 3. Regional Engineer Oversight
The Regional Engineer role provides high-level monitoring across all divisions within a region.
- **Jurisdiction**: Can view all projects in the region, filtered by the JWT `region` claim.
- **Read-Only**: Access is strictly limited to viewing; no "Ground Truth" updates are permitted at the regional level to preserve accountability.
- **UI Consistency**: Mirrors the Division Engineer dashboard for unified technical training.

## 4. Regional Data Extraction Protocol
For large-scale reporting, data is extracted using a "Multi-Unit Flattening" pattern.
- **Flattened Export**: All school metadata (Units 1-9) is joined into a unified relational row for each granular infrastructure asset.
- **Safety**: Exports use read-only `SELECT` operations to ensure zero impact on production workloads.

---
*Consolidated from: `InsightEd_Division_Engineer_Guide.md`, `InsightEd_School_Head_Guide.md`, `ADR-013`, and `regional_extraction_documentary.md`.*
