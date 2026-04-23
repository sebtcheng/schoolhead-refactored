# Architecture Decision Record (ADR-004)
# Automated School Registration & IERN Generation System

**Date:** 2026-04-07  
**Status:** Accepted  
**Context:** SDO Submission Workflow  

## 1. Context & Problem
Previously, school registration required a manual two-step process: SDO submission followed by Admin approval. This introduced significant delays in data availability and required administrative overhead for routine data entry.

## 2. Decision: Automated Instant Activation
We have shifted to an **Automated Instant Approval** model where SDO submissions are immediately activated in the master database.

### Core Architectural Components:
1. **Frontend (`SchoolManagement.jsx`)**: Implements strict real-time validation (School ID existence, Naming standards, numeric-only enforcement).
2. **Backend (`api/index.js`)**: Merges submission and approval logic into a single atomic database transaction.
3. **Database (`schools_IERN`)**: Acts as the authoritative master registry.
4. **Audit Log (`pending_schools`)**: Retains a permanent historical record of all SDO submissions for auditability.

## 3. Implementation Details

### A. Sequential IERN Generation
To ensure unique and predictable identifiers, the system uses a Year-Based Sequential ID (`YYYY-XXXXX`).
- **Algorithm**: Fetches the last IERN matching the regex `^[0-9]{4}-[0-9]+$` (to exclude test data like `SDO-164000`) and increments the numeric suffix by 1.
- **Resilience**: The generator automatically adapts to the current system year.

### B. Self-Healing Schema
The system automatically verifies the `schools_IERN` table schema upon server startup, adding critical columns (`"Latitude"`, `"Longitude"`, `"Mother_School_ID"`) if they are missing.

### C. Data Integrity Guards
- **ID Check**: Blocks submission if the 6-digit School ID already exists in `schools_IERN`.
- **Abbreviation Filter**: Blocks common abbreviations (ES, NHS, PS, etc.) to enforce DepEd naming standards.
- **Document Locking**: Requires a valid PDF upload before enabling the "Submit" action.

## 4. Security & Compliance
- **RBAC**: Access restricted strictly to the **"School Division Office"** role.
- **Auditability**: Every auto-approved school maintains a link to its original submission entry in `pending_schools`.

## 5. Consequences
- **Positive**: Instant data availability for audits and monitoring; reduced administrative burden.
- **Neutral**: SDO users assume full responsibility for data accuracy (mitigated by strict UI validation).
- **Negative**: Manual deletion required in the master registry for erroneous entries (though rare due to validation).
