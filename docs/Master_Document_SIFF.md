# SIFF Data Collection - Master Document

The **SIFF (School Initiative Funding & Flow)** module is a core financial tracking node within InsightED. It provides School Heads with a transparent, gamified interface to manage earmarked funds, from annual initialization to quarterly liquidation.

---

## 🏛️ Strategic Governance

SIFF is governed by strict business rules defined at the Central Office level to ensure fiscal discipline and data integrity.

### Core Protocol
- **Annual Initialization**: School fund balances are set once a year directly in the central database.
- **Master List Control**: The list of Initiatives and Activities is managed exclusively by the Central Office.
- **Zero-Evidence Liquidation**: To ensure administrative efficiency, no physical evidence (PDFs/Photos) is required for liquidation updates.
- **Variance Justification**: Any deviation between planned and actual amounts requires a mandatory justification (Max 250 words).

---

## 🛠️ Operational Flow

1. **Initialize**: Central Office seeds the school's running balance via the database.
2. **Plan & Allocate**: School Head selects **Initiatives** and corresponding **Activities** from standardized dropdowns.
3. **Obligate**: As funds are assigned, the data is instantly transmitted to SDO and RO dashboards for monitoring.
4. **Liquidate**: On a quarterly basis, School Heads record actual expenditures.
5. **Justify**: If the execution varies from the plan, a justification must be provided.

---

## 💎 Features & UX

### Nexus Node Integration
SIFF is integrated as a premium card in the school head's Nexus Dashboard, providing immediate visibility into the school's financial health.

### Hierarchical Data Collection
A two-tier dropdown system (Initiative -> Activity) ensures that data collection is granular and mapped to national standards.

### Real-Time Synchronization
All financial movements are synchronized in real-time with the SDO and RO monitoring layers, enabling proactive oversight.

### Gamified Engagement
Schools are awarded **Transparency Points (XP)** for maintained accuracy and timely submissions, fostering a culture of financial accountability.

---

## 📂 Data Schema Reference

| Table | Purpose | Managed By |
| :--- | :--- | :--- |
| `siff_funds` | Yearly total and running balance per school. | Central Office (DB Only) |
| `siff_initiatives` | Master list of allowed funding initiatives. | Central Office |
| `siff_activities` | Activities mapped to specific initiatives. | Central Office |
| `siff_obligations` | Current planned allocations by the school. | School Head |
| `siff_liquidations` | Recorded actuals and justifications. | School Head |

---
*Generated: 2026-04-21 • InsightED Official Portfolio 2026*
