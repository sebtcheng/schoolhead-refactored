# ADR 002: Unified Staging Recovery & Forensic Healing

## Status
Accepted

## Context
The InsightEd Staging server (`20.24.58.49`) suffered from a fragmented recovery process. Multiple discrete scripts (`deploy-staging.sh`, `forensic_heal.sh`) had to be run in sequence, but they were often out of sync (e.g., deployment omitting critical files like `compress_pdf.py` that the healing script expected). Additionally, environment-specific issues like "Sudo for Windows" and non-standard tool PATHs made manual recovery error-prone and time-consuming.

## Decision
We decided to implement a **Unified Recovery Protocol** via a single node-based script: `deploy-and-heal-staging.cjs` (aliased to `npm run heal:staging`).

### Technical Details:
1.  **Atomic Deployment:** The script bundles all necessary dependencies, including the Python compression engine and Nginx configuration templates, into a single tarball.
2.  **Remote Orchestration:** It uses the `ssh2` library to pipe local build outputs directly into a remote execution environment, automatically triggering the forensic healing process after extraction.
3.  **Hardened Healing Logic:** The remote healing script (`forensic_heal.sh`) was upgraded with "Smart Path Discovery" to find `pm2` and `psql` in non-standard locations and "Sudo Resilience" to handle restricted permission environments.

## Alternatives Considered
1.  **Manual SCP/SSH:** This was the existing method, but it led to "Manager Fatigue" and repeated configuration drift when developers forgot to include side-car scripts in the deployment.
2.  **Config Management (Ansible/Chef):** Overkill for a single staging VM and would introduce additional infrastructure complexity.
3.  **CI/CD Pipeline (GitHub Actions):** Preferred for production, but staging often requires rapid "vibe coding" and manual forensic interventions that a rigid CI pipeline might hinder.

## Consequences
-   **Pros**:
    -   Reduces recovery time from ~10 minutes to <2 minutes.
    -   Eliminates "Missing File" errors on staging.
    -   Idempotent and safe to run multiple times.
-   **Cons**:
    -   Adds a dependency on the `ssh2` node module in `devDependencies`.
    -   Hardcodes staging credentials (mitigated by using existing staging-specific user accounts).
