# ADR 003: Timeout Hardening for Large PDF Uploads

## Status
Accepted

## Context
Large PDF uploads (20MB+) to the InsightEd staging server were failing with `504 Gateway Time-out`. Investigation revealed multiple bottlenecks:
1.  **Nginx Proxy Buffering:** By default, Nginx buffers the entire request body before forwarding it to the backend. This caused timeouts during the upload phase for slow connections or large files.
2.  **Proxy Timeouts:** The `proxy_read_timeout` was set to 300s, which was insufficient for the PDF compression pipeline that runs synchronously in the background (via `compress_pdf.py`).
3.  **Backend Server Timeouts:** Node.js (via `http.Server`) has default timeouts that were terminating connections before the processing could complete.

## Decision
We decided to implement "Deep Hardening" of the upload pipeline by aligning timeouts across the proxy and backend layers, and disabling request buffering to allow streamed processing.

### Technical Details:
1.  **Nginx Buffering:** Set `proxy_request_buffering off;` in the staging API location block. This allows the backend (via `busboy`) to start receiving the file stream immediately.
2.  **Cross-Layer Timeout Alignment:** Increased all relevant timeouts to **600 seconds (10 minutes)**:
    - **Nginx:** `proxy_read_timeout`, `proxy_send_timeout`, `proxy_connect_timeout`, and `client_body_timeout`.
    - **Node.js:** `server.timeout`, `server.keepAliveTimeout`, and `server.headersTimeout`.
3.  **Persistence:** Integrated these settings into the authoritative `tmp_stride.conf` and updated the `forensic_heal.sh` check from 300s to 600s to ensure automated recovery enforces the new standard.

## Alternatives Considered
1.  **Async/Queue Processing:** Moving the PDF compression to a worker queue (e.g., BullMQ/Redis) would be the architectural "ideal," but it would add significant infrastructure complexity (requiring a Redis server) that is currently unjustified for the single-node staging environment.
2.  **S3/Cloud Storage Direct Upload:** Bypassing the server for uploads. Rejected due to the requirement for on-server PDF compression before final storage.

## Consequences
-   **Pros**:
    -   Successfully handles 27MB+ PDF uploads.
    -   Eliminates 504 errors during heavy processing tasks.
    -   Streamlined upload experience (no wait for buffering).
-   **Cons**:
    -   Increases the potential for long-running "zombie" connections if many large uploads occur simultaneously (mitigated by `client_max_body_size 100M`).
    -   Requires more memory on the backend for concurrent streams.

---
*Verified by Antigravity (Avid Documenter Module) - 2026-04-04*
