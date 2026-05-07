# ADR: SIIF Isolated Monorepo Service Architecture

**Date:** 2026-05-05  
**Status:** Active (Local Development)  
**Target URL (Production):** `https://stride.deped.gov.ph/insighted-siif/`

---

## Executive Summary

The SIIF (School Innovation and Improvement Fund) module was architected as an **isolated monorepo service** within the `InsightEd-SchoolHead-Official` repository. This follows the precedent established by `isolated_deployment_deped_mgmnt.md` — separating the service into its own backend and frontend, living in a dedicated `siif-service/` folder.

## Monorepo Structure

```
InsightEd-SchoolHead-Official/
├── api/index.js                ← Main InsightEd backend (UNTOUCHED)
├── src/                        ← Main InsightEd frontend (only SIIF card added)
│
└── siif-service/               ← SIIF Isolated Workspace
    ├── package.json            ← Root scripts (dev:api, dev:ui, dev:full)
    ├── ecosystem.siif.config.cjs  ← PM2 production config (port 3001)
    │
    ├── api/
    │   └── index.js            ← Self-contained Express server on port 3001
    │                              Own pg.Pool (max 5 connections)
    │                              Own JWT auth middleware
    │
    └── ui/                     ← Standalone Vite + React app
        ├── package.json
        ├── vite.config.js      ← Proxies /api/siif → localhost:3001 in dev
        ├── tailwind.config.js
        └── src/
            ├── App.jsx         ← Token bootstrap (URL param for dev, localStorage for prod)
            ├── pages/
            │   ├── SIIFDashboard.jsx
            │   └── SIIFForm.jsx
            └── index.css
```

## Local Development Commands

```bash
# From the InsightEd-SchoolHead-Official root:
npm run dev:full   # Main app (port 5173 + 3000)

# From siif-service/:
npm run dev:api    # SIIF backend (port 3001)
npm run dev:ui     # SIIF UI (port 5174)
npm run dev:full   # Both together
```

## Auth Strategy

| Environment | Method |
|---|---|
| **Production** | Both apps on same origin (`stride.deped.gov.ph`), so `localStorage` is shared. Token reads automatically. |
| **Development** | Different origins (5173 vs 5174). InsightEd passes `?token=xxx` in the URL. SIIF `App.jsx` reads it, stores under `siif_token` in localStorage, cleans URL. |

## Production Deployment (Future)

1. `npm run build` in `siif-service/ui/` with `VITE_BASE_PATH=/insighted-siif/`
2. Copy `dist/` + `api/` to VM: `/var/www/html/InsightEd-SchoolHead/siif-service/`
3. Add Nginx location blocks:
   ```nginx
   location /insighted-siif/ {
       alias /var/www/html/InsightEd-SchoolHead/siif-service/ui/dist/;
       try_files $uri $uri/ /insighted-siif/index.html;
   }
   location /api/siif/ {
       proxy_pass http://127.0.0.1:3001/api/siif/;
   }
   ```
4. `pm2 start siif-service/ecosystem.siif.config.cjs`

---
**Custodian:** Master Librarian + Master Architect  
**Security Tier:** Isolated Microservice
