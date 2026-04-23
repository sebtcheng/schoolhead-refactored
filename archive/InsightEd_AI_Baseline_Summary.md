# InsightEd: Comprehensive AI Training Baseline & Summary

## 1. Overview & Context
**InsightEd** is a mobile-first Progressive Web App (PWA) developed for the **Philippine Department of Education (DepEd)**. Its primary mission is to provide a high-integrity, real-time data collection and monitoring system for school infrastructure, enrollment, and resources.

- **Status**: Currently in Phase II Pilot Testing.
- **Problem Solved**: Replaces fragmented, slow, or unreliable manual reporting with a unified digital platform that works in remote areas with zero connectivity.
- **Key Philosophy**: **"Data Health as a Mandate."** The system doesn't just collect data; it algorithmically verifies it using advanced statistical models (Fraud Detection).

---

## 2. Target User Roles
1. **School Heads**: The primary data providers. They fill out modular forms ("Units") covering school profiles, learner statistics, and physical facilities. Their goal is to maintain a high "Data Health Score."
2. **Division Engineers**: The verifiers. They track infrastructure projects (repairs, new builds), perform on-site inspections, and upload geo-tagged photographic evidence to validate school reports.
3. **Super Users / Admins**: Monitor regional/divisional performance, manage users, and access high-level analytics.

---

## 3. Technology Stack
### Frontend (Mobile-First PWA)
- **Framework**: React 19 + Vite.
- **Styling**: Tailwind CSS for responsive UI; Framer Motion for smooth transitions.
- **State Management**: React Hooks + Context.
- **Maps**: React-Leaflet (OpenStreetMap) for geo-tagging and site mapping.
- **Charts**: Recharts & Plotly for interactive data visualization.
- **Offline Capability**: **IndexedDB** (via `idb` library) for local caching. **Vite PWA Plugin** for service worker management.

### Backend (Serverless/Hybrid)
- **Runtime**: Node.js/Express.
- **Database**: PostgreSQL (hosted on Azure/Neon) with **Knex.js** as the query builder.
- **Authentication**: Firebase Admin SDK (for JWT/Custom Tokens) + Native Bcrypt hashing for fallback.
- **File Storage**: Azure Blob Storage (stores high-res construction photos and PDF reports).
- **Communication**: Nodemailer (via Gmail) for OTP and notifications.

### AI & Data Intelligence
- **LLM Orchestration**: LangChain (`@langchain/google-genai`, `@langchain/openai`).
- **Localized AI**: Ollama hosted on a dedicated Azure VM (running Llama 3 & Nomic Embeddings) for privacy-compliant chatbot support.
- **Analytics**: Python (Pandas, Scipy, Sklearn) for the **Advanced Fraud Detection** engine.

---

## 4. Application Structure (Key Directories)
- `/api`: The Express server. Contains `index.js` (core routes), `db_init.js` (schema migrations), and `chatbot.js`.
- `/src`: The React frontend.
  - `/components`: Modular UI elements and layout wrappers.
  - `/modules`: Feature-specific pages (e.g., `PhysicalFacilities.jsx`, `TeachingPersonnel.jsx`).
  - `/utils`: Helper functions (e.g., `safetyScore.js`).
  - `db.js`: The IndexedDB implementation logic for offline data persistence.
- `/root`:
  - `advanced_fraud_detection.py`: The heart of the scoring engine.
  - `package.json`: Dependency and script management.

---

## 5. Core Features & Functional Processes

### A. Modular Reporting (The "Units")
Data entry is broken into logical "Units" to prevent cognitive overload:
- **Unit 1-4**: School Profile, Enrollment, and basic stats.
- **Unit 5-6**: Shifting schedules and Teacher roster management.
- **Unit 7-9**: Resources (Water/Power), Facilities (Building inventory), and Geography/Safety.

### B. Offline-First "Sync Center" (The Outbox)
The PWA uses a **Local-First Architecture**:
1. Users fill out forms offline in remote areas.
2. Data is stored in IndexedDB (`InsightEd_Outbox`).
3. When internet is detected, the **Sync Center** allows users to "Sync All" to the central database.
4. Large payloads (like photos) are queued and transmitted with retry logic.

### C. Advanced Fraud Detection & Data Health
Every school submission is graded by an AI/Statistical engine (`advanced_fraud_detection.py`):
- **Univariate Analysis**: Flags extreme outliers (e.g., a school with 1,000 students but only 1 teacher) using **Modified Z-Scores**.
- **Multivariate Analysis**: Uses **Mahalanobis Distance** to detect weird combinations of data points that don't fit the typical "school profile."
- **Consistency Rules**: Cross-checks related fields (e.g., does the sum of grade-level enrollment match the total reported?).
- **Scoring**: Schools receive a score from 0-100 (Excellent, Good, Fair, Critical).

### D. Infrastructure Verification Workflow
Engineers use the app to:
- Monitor active repair/build projects.
- Update "Accomplishment Percentage" via a slider.
- **Verification Rule**: Must upload **Geo-tagged Internal & External photos** before a project can be marked "Completed."

### E. AI Chatbot Support
An integrated assistant helps users:
- Document technical bugs directly into a `bug_reports` table.
- Query the FAQ knowledge base (migrated from JSON to `pgvector` for semantic search).

---

## 6. Development & Deployment Processes
- **Environment**: Managed via `.env` with strict separation of production and staging.
- **Database Migrations**: Handled within the `api/index.js` and `db_init.js` during server startup (Auto-migrate pattern).
- **Deployment**: 
  - Frontend: Vercel.
  - Backend: Node.js server (Azure/Ubuntu with PM2).
  - AI: Dedicated GPU VM for Ollama.

---
*Created on: 2026-03-24*
*Version: 1.0.0 (AI Training Baseline)*
