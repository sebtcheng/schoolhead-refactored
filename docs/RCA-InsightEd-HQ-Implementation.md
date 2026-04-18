### 🐛 Incident Report: InsightEd HQ Implementation
**Date:** 2026-04-18 | **Status:** Resolved

**🏷️ Clustering Metadata:**
* **Theme:** Feature / Infra | **Aspect:** Standalone Integration | **Complexity:** Medium | **Priority:** High

#### 1. The Problem & Symptom
* **Objective:** Create a standalone "Command Center" (InsightEd HQ) for high-level oversight of school head and engineer data.
* **Requirements:** Decoupled from the main PWA, premium Glassmorphic UI, dedicated auth registry, and zero-downtime Nginx integration.

#### 2. Root Cause Analysis (The "Why")
* **Performance Isolation**: Analytical dashboards for "higher-ups" involve heavy aggregation queries. Running this on a dedicated port (3005) and path (/insighted-hq/) ensures that analytical traffic does not compete with standard operational traffic for event-loop or DB socket priority.
* **Infrastructure Safety**: Implementing this as a standalone service prevents deployment risk to the core PWA while maintaining shared access to the "Single Source of Truth" database.

#### 3. The Final Fix
* **Database**: Migration #27 added `command_center_user` using **Advisory Locking** (Lock ID: 20260418) to ensure idempotent, race-condition-free initialization.
* **Backend**: Standalone Node.js Express API using **Single-Flight Caching** (90s TTL) for Overview and Regional KPI queries.
* **Frontend**: Standalone Premium SPA using **Vanilla HTML/CSS/JS** to minimize runtime dependencies and maximize load speed.
* **Nginx**: Pro-Spec configuration with **Layer 1 & 2 Cache Hardening** and optimized header forwarding.

#### 4. Observability & Resiliency
* **Structured Telemetry**: All backend operations use the `[CC-BACKEND]` prefix for log isolation.
* **Connection Security**: Strictly enforced Port 6432 (PgBouncer) to prevent database connection starvation during analytics bursts.

---

### 🚀 Momentum Prompts
> [!TIP]
> **Status:** Implementation Complete (Phases 1-4) | **Next:** Deployment to Azure VM
> **Decision:** Standardized on the named sub-path `/insighted-hq/` to maintain ecosystem consistency with `/insighted/` and `/opdash/`.
> **Continuity:** Shall we initiate the file transfer to the Azure VM, or would you like to add more "Full Spectrum" data points (e.g., specific facility counts) to the HQ overview?
