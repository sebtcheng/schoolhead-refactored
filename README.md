# InsightEd School Head Node

Standalone server and frontend environment optimized for School Head operations.

## Overview
This codebase has been surgically decoupled from the monolithic InsightEd backend to provide a lean, performant, and stable deployment for school-level personnel. All infrastructure, engineering, and SDO-level monitoring systems have been removed.

## Features
- **ESF7 Modular Flow:** Units 1-9 for school identity, learners, resources, and facilities.
- **Offline Reliability:** Service worker integration for field data collection.
- **Role-Based Portals:** Dedicated access for School Heads and Admins.
- **Secure Authentication:** Passcode and password login with session persistent.

## Key Changes (Phase 2 Decoupling)
- **Backend:** Removed all infrastructure, engineering, and LGU-related DDL and logic.
- **Frontend:** Flushed 50+ routes and 100+ components related to non-school functions.
- **Sanitization:** Deleted 200+ diagnostic and migration scripts to reduce attack surface and codebase weight.

## Development
- `npm run dev`: Start Vite dev server.
- `npm run dev:turbo`: Start backend server with instant reload.
- `api/index.js`: Core backend entry point.
- `src/App.jsx`: Frontend route management.

---
© 2026 InsightED. Secure & Encrypted.
