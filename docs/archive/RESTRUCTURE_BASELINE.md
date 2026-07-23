# Restructure Baseline

## Git State
Branch: `schoolhead-refactored`
Commit: `a5d26e3` (Merge pull request #8 from clea241/klein-feature-updates)

## Core Files & Entry Points
- Frontend: `index.html` -> `src/main.jsx` -> `src/App.jsx`
- Backend API Entry: `api/index.js`
- Migration & DB Init: `server/db_init.js`
- Database Pool & Helpers: `server/utils/db.js`
- Auth Middleware: `server/middleware/authMiddleware.js`
- General Server Helpers: `server/utils/helpers.js`

## Backend Router Mount Order in `api/index.js`
1. Public / Health: `/api/ping`, `/api/health`, `/api/pool-status`
2. SIIF Module: `/api/siif` (`server/modules/siif/index.js`)
3. Auth: `/api/auth` (`server/units/auth/index.js`)
4. Units:
   - `/api/ph_schools/unit1` (`server/units/unit1/index.js`)
   - `/api/ph_schools/unit2` (`server/units/unit2/index.js`)
   - `/api/ph_schools/unit3` (`server/units/unit3/index.js`)
   - `/api/ph_schools/unit4` (`server/units/unit4/index.js`)
   - `/api/ph_schools/unit5` (`server/units/unit5/index.js`)
   - `/api/ph_schools/unit6` (`server/units/unit6/index.js`)
   - `/api/ph_schools/unit7` (`server/units/unit7/index.js`)
   - `/api/ph_schools/unit8` (`server/units/unit8/index.js`)
   - `/api/ph_schools/unit9` (`server/units/unit9/index.js`)
5. Supporting Services:
   - `/api/dashboard` (`server/units/dashboard/index.js`)
   - `/api/docs` (`server/units/docs/index.js`)
   - `/api/settings` (`server/units/settings/index.js`)
   - `/api/push` (`server/units/push/index.js`)
   - `/api/chat` (`server/units/chat/index.js`)
   - `/api/location` (`server/units/location/index.js`)

## Main Route Set
- `/` -> Login / Landing / Main App
- `/nodes-dashboard`
- `/modular/unit-1` ... `/modular/unit-9`
- `/siif/*`
- `/settings`
