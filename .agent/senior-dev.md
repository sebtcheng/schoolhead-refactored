# 🚀 Senior SDE "Antigravity" Skills Package
**Focus:** Correctness, Robustness, Execution, and Structural Integrity

This document outlines the core competencies and methodologies required for a Senior Software Development Engineer to evaluate, adjust, and elevate an implementation plan. The goal is to build systems that are resilient, scalable, and elegantly structured—essentially making the complex feel effortless.

---

## 🛠️ Integrated Skills & Workflows
*Standardized protocols for the InsightEd Ecosystem.*

- **[Skill: Infrastructure Mastery](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/.agent/skills/infrastructure-mastery/SKILL.md)**: Expert PgBouncer, Azure PostgreSQL, and connection pool scaling.
- **[Workflow: /db-crisis-resolution](file:///e:/InsightED%20April%202026/InsightEd-Mobile-PWA-2026/.agent/workflows/db-crisis-resolution.md)**: Standard operating procedure for resolving database starvation and lock contention.

---

## 1. Correctness: Defying Logic Bugs
*Ensuring the code does exactly what it is supposed to do, under all expected conditions.*

* **Advanced Testing Strategies:**
    * **Test-Driven & Behavior-Driven Development (TDD/BDD):** Guiding architectural design through testability.
    * **Mutation Testing:** Evaluating the quality of existing tests by introducing small bugs (mutants) and ensuring the test suite catches them.
    * **Property-Based Testing:** Testing code against a wide range of generated inputs rather than hardcoded edge cases (e.g., using libraries like FastCheck or Hypothesis) to find obscure edge cases.
* **Static Code Analysis & Tooling:**
    * Integrating strict linting, type-checking (e.g., advanced TypeScript configurations, static analyzers), and vulnerability scanning directly into the IDE and pre-commit hooks.
* **Formal Verification Concepts:** * Applying state-machine logic to ensure complex UI or backend states cannot enter impossible or unhandled conditions.

## 2. Robustness: Gravitational Pull Resistance
*Ensuring the system survives and gracefully degrades when the unexpected happens (network failures, bad data, traffic spikes).*

* **Resiliency Patterns:**
    * **Circuit Breakers:** Preventing cascading failures by stopping requests to a failing downstream service.
    * **Retry Mechanisms with Exponential Backoff:** Handling transient network glitches without overwhelming recovering services.
    * **Bulkheading:** Isolating critical system components so a failure in one area doesn't sink the entire application.
* **Chaos Engineering Principles:**
    * Designing systems with the assumption that components *will* fail, and periodically injecting faults to test the system's automated recovery.
* **Defensive Programming:**
    * Rigorous input validation, boundary checking, and avoiding silent failures. Implementing "fail fast, recover gracefully" paradigms.

## 3. Execution of Implementation Plan: Orbit Insertion
*Taking a design from a whiteboard to a live production environment safely and efficiently.*

* **Progressive Delivery:**
    * **Feature Flags/Toggles:** Decoupling deployment from release, allowing code to be pushed to production but kept dormant until ready.
    * **Canary Releases & Blue-Green Deployments:** Routing a small percentage of traffic to new infrastructure to verify stability before a full rollout.
* **Observability & Telemetry:**
    * Implementing comprehensive logging (structured logs), metrics (latency, error rates, throughput), and distributed tracing. 
    * You can't fix what you can't see; execution requires setting up alerts that trigger *before* the user notices an issue.
* **CI/CD Pipeline Mastery:**
    * Designing automated, idempotent, and highly reliable build and deployment pipelines that act as the ultimate gatekeeper for code quality.

## 4. Structural Adjustments & Integrity: Refactoring the Hull
*Continuously improving the codebase to prevent "software rot" and technical debt accumulation.*

* **Architectural Smells & Refactoring:**
    * Identifying tight coupling, leaky abstractions, and god objects, and proactively refactoring them using SOLID principles and Domain-Driven Design (DDD).
* **The Boy Scout Rule:**
    * Leaving the codebase cleaner than you found it with every PR, making incremental, low-risk structural improvements alongside feature work.
* **Code Review Leadership:**
    * Conducting reviews that go beyond syntax. Checking for architectural alignment, thread safety, performance bottlenecks, and long-term maintainability.
* **Technical Debt Management:**
    * Accurately quantifying technical debt and advocating for its resolution during sprint planning by demonstrating its impact on future velocity and system stability.

## 5. Database Concurrency & Performance: Slipstream Scaling
*Ensuring the database remains responsive under high load by avoiding blocking operations and connection starvation.*

* **Strict DDL/DML Separation:**
    * **No DDL on Hot Paths:** Never execute `ALTER TABLE` or other structural changes within request handlers. DDL operations acquire `AccessExclusiveLock`, which bricks the system by stalling all other queries.
    * **Boot-Level Migrations:** Schema changes must be encapsulated in idempotent, boot-level initialization scripts (e.g., `initUnit7Schema`).
    * **Advisory Locking:** Use `pg_try_advisory_lock` during boot to ensure only one cluster worker manages migrations, preventing race conditions.
* **Connection Management & Decoupling:**
    * **Asynchronous Analytics:** Transition non-critical secondary operations (e.g., `updateSchoolTotalCompletion`) to fire-and-forget or background workers. Free the database socket instantly.
    * **Pool Starvation Prevention:** prioritize "Fail-Fast" timeouts over large queues. Fix root cause locks rather than masking them with larger connection pools.

## 6. Agent Workflow & Compliance
*Ensuring all AI agents maintain consistency and transparency within the workspace.*

* **Mandatory Architectural Alignment:** Agents **MUST** create an implementation plan in `/claude/[feature_name]_plan.md` before executing any structural or logic changes.
* **Mandatory Progress Tracking:** Agents **MUST** maintain a separate checklist in `/claude/task.md` for the current task.
* **Path Strictness:** Always use absolute paths or relative paths from the root, and ensure all planning artifacts are indexed in the `claude` folder.

---

## 🛡️ Infrastructure Crisis Playbook: The InsightEd Protocol
*Hard-won lessons from the April 2026 Connection Crisis.*

### 1. The PgBouncer Bypass Trap
*   **Symptom:** "Timeout exceeded when trying to connect" errors despite PgBouncer being active.
*   **Audit:** Check the application's `.env` for `DATABASE_URL`.
*   **The Trap:** If port `5432` is used, the app is bypassing the proxy and hitting a local/underpowered standalone DB.
*   **Fix:** Force all traffic to `6432` (PgBouncer) to enable transaction-level pooling and route to the robust Azure Cloud instance.
*   **⚠️ Incident Note (2026-04-14):** A major 5xx crisis occurred when the local `.env` reverted to port `5432`. Solving this required both the `.env` fix AND running `fave_scripts/relief_db_locks.py` to clear the residual logs and expand the pool size.
*   **⚠️ Incident Update (2026-04-15):** Resolved "no more connections allowed" by updating `/etc/pgbouncer/pgbouncer.ini` to `listen_addr = *`. This allows local development environments to leverage the high-capacity VM pool. SSL must be disabled for these connections if PgBouncer is not configured for `client_tls`.

### 2. Identifying Infrastructure Ceiling
*   **Audit:** Run `SHOW max_connections;` on the Azure DB directly.
*   **Optimization:** If the ceiling is high (e.g., 1718 connections), do not use restrictive Node.js `max: 5` caps. Scale PgBouncer `pool_size` (e.g., 500) and Node `max` (e.g., 100) to allow bursts without internal queueing.

### 3. Sequential Scan Eradication
*   **Symptom:** High "DB" connection counts on the dashboard even during low traffic.
*   **Audit:** Check `pg_stat_user_tables` for `seq_scan` counts. Large tables (60M+ rows) must have concurrent indexes on high-cardinality join/filter columns (e.g., `user_uid`).

### 4. Disk I/O Blocking (Nginx)
*   **Audit:** Check root disk usage (`df -h`). Large `access.log` files (>1GB) can choke I/O.
*   **Fix:** Truncate logs immediately (`> access.log`) and verify `/etc/nginx/sites-enabled/` for malformed `.bak` files that might prevent clean reloads.
*   **⚠️ Incident Note (2026-04-14):** Truncating `/var/log/nginx/access.log` (which was >100MB and growing rapidly) was a critical step in lowering I/O latency during the recovery phase.

### 5. SSL & Local Development
*   **Problem:** Backend fails with `server does not support SSL connections` when connecting to PgBouncer.
*   **Fix:** Ensure the `isLocal` regex in `api/index.js` includes the VM IP (`20.24.58.49`) to disable client-side SSL when routing through the pooler, as PgBouncer often terminates SSL or is configured for non-TLS internal traffic.

### 6. Stride Dashboard Multi-Project Dependency
*   **Critical Dependency:** The `stride-app` (Port 3002) MUST be online for the entire ecosystem to function correctly.
*   **Symptom:** If `stride-app` is down or missing from PM2, Nginx will return **502 Bad Gateway** for BOTH `insighted-backend` and `insighted-staging` request paths, as the root upstream failure can cascade through the shared configuration.
*   **Maintenance Rule:** Never delete or stop the `stride-app` PM2 process without first re-mapping the Nginx root to a temporary static landing page or health responder.

### 7. Tier 2 Recovery: Forensic Deep Relief
*   **Symptom:** Tier 1 (`relief_db_locks.py`) runs but `vm_diagnostics.py` still shows **DB: 0** or app errors persist (ECONNREFUSED).
*   **The Problem:** The app is bypassing the pool entirely due to `.env` drift, or "Zombie" PM2 processes are stuck on a stale configuration.
*   **Fix:** Run `fave_scripts/deep_relief_db.py`.
*   **Action:** This script autonomously audits `.env` for the PgBouncer Bypass Trap, SIGKILLs non-responsive workers, and triggers the Tier 1 relief protocol.