# QuickStart Guide: Local Development Setup

This guide provides step-by-step instructions for team members cloning this repository to get the application installed and running locally using `npm run dev:full:legacy`.

---

## 📋 Prerequisites

Before starting, ensure you have the following installed on your machine:
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **Git**
- **npm** (comes with Node.js)

---

## 🚀 Step-by-Step Setup Guide

### 1. Install Monorepo Dependencies & Link Shared Packages

This is a **pnpm Turborepo monorepo**. You **MUST** run `npx pnpm install` so pnpm links the internal `@shared/*` packages (`@shared/db`, `@shared/auth`, `@shared/io`, `@shared/types`, `@shared/ui`) into `node_modules`:

```bash
npx pnpm install
```

> 💡 **Note**: If you have `pnpm` installed globally (`npm i -g pnpm`), you can simply run `pnpm install`.

---

### 2. Start the Application

Run the combined dev command to launch both the **Express Backend Server** (port `3000`) and the **Vite Frontend Dev Server** (port `5173`) concurrently:

```bash
npm run dev:full:legacy
```

---

### 3. Access the Web App

Once launched:
- 🌐 **Frontend App**: [http://localhost:5173/insighted-schoolhead/](http://localhost:5173/insighted-schoolhead/)
- 📡 **Backend API**: [http://localhost:3000/api](http://localhost:3000/api)

---

## 🛠️ Common Troubleshooting

### 1. `Cannot find package '@shared/db'` or `@shared/*` module errors
- **Cause**: Workspace symlinks are not created in `node_modules`.
- **Solution**: Run `npx pnpm install` at the root directory.

### 2. `[VITE] http proxy error: ... ECONNREFUSED 127.0.0.1:3000` during startup
- **Cause**: Vite starts in ~300ms, while Express takes 2–4 seconds to initialize database connections and run pre-flight migrations.
- **Solution**: This is normal. Wait a few seconds until the backend logs `✨ InsightEd Master Server listening on port 3000`.

### 3. Missing CSS / Unstyled UI
- **Cause**: Tailwind CSS purge cache or unlinked dependencies.
- **Solution**: Stop the server (`Ctrl+C`), run `npx pnpm install`, and restart with `npm run dev:full:legacy`.

---

## 📂 Repository Structure Overview

- `apps/school-head/api/` — Express backend API (Port 3000)
- `apps/school-head/web/` — React + Vite School Head PWA (Port 5173)
- `apps/siif/api/` — SIIF Module backend routes (`/api/siif/*`)
- `apps/siif/web/` — SIIF standalone frontend app
- `packages/` — Shared workspace packages (`@shared/db`, `@shared/auth`, `@shared/io`, `@shared/types`, `@shared/ui`)
