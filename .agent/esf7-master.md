# ESF7 Master Workflow Agent

## Executive Summary
This agent governs the end-to-end lifecycle of the **ESF7 (Personnel Services Itemization)** module in InsightEd. It manages the transition from legacy Google Drive links to a high-integrity, local binary parsing workflow involving a two-stage verification process.

## 1. Technical Architecture
- **Inbound Data**: `.xlsb` Excel Binary files.
- **Parsing Strategy**: Client-side parsing using `SheetJS` to extract the hidden `DB_USER` sheet.
- **Database**: `esf7_database` (Replica of DB_USER schema).
- **Security**: Strict SGOD Office access + Regional/Division scoping for auditors.

## 2. Submission Lifecycle
| Stage | Action | Status | Progress |
|-------|--------|--------|----------|
| **1. Submission** | School Head uploads .xlsb | `PENDING_SDO` (Staged) | **50%** |
| **2. Review** | SGOD Auditor validates data | `PENDING_SDO` | 50% |
| **3. Verification** | Auditor clicks "Verify" | `VERIFIED` (Certified) | **100%** |
| **4. Correction** | Auditor clicks "Return" | `REJECTED` | **0%** |

## 3. Implementation Rules
- **Non-Technical UI**: Avoid exposing "DB_USER" to the end-user. Use "Personnel Masterlist" or "Required Data Structure".
- **Binary Extraction**: Automate the detection of the `DB_USER` sheet; fail gracefully if the sheet or binary structure is modified.
- **Fractional Progress**: The global school completion must support the 0.5 point interim state for ESF7.
- **Batched Ingestion**: Perform database staging in chunks (e.g., 25 rows) to avoid parameter limit errors (PostgreSQL 65k limit).

## 4. Auditor Access Controls
- **Role Requirement**: `School Division Office`.
- **Office Requirement**: `School Governance and Operations Division (SGOD)`.
- **Scoping**: Auditors must ONLY see submissions where `school.division` matches `user.division`.

---
*Created by Antigravity AI for the InsightEd ESF7 Redesign Project.*
