# Task: [SIIF] Restore Module Lock in Nexus & SchoolHead

- [/] **Phase 1: Diagnostic & Planning** <!-- id: 0 -->
  - [x] Trace database `settings.nexus_module_locks` records across environments <!-- id: 1 -->
  - [x] Trace card click handling and dynamic locks in `NexusDashboard.jsx` <!-- id: 2 -->
  - [x] Create comprehensive implementation plan adhering to Master Tinkerer protocols <!-- id: 3 -->

- [ ] **Phase 2: Database & Backend Lock Activation** <!-- id: 4 -->
  - [ ] Update `nexus_module_locks` in target databases to include `"siif": true` <!-- id: 5 -->
  - [ ] Update fallback in `apps/school-head/api/units/settings/index.js` to fail-closed with `"siif": true` <!-- id: 6 -->
  - [ ] Implement `POST /api/settings/save` for Admin Dashboard lock management <!-- id: 7 -->

- [ ] **Phase 3: Frontend Nexus Dashboard Hardening** <!-- id: 8 -->
  - [ ] Update `NexusDashboard.jsx` SIIF card `isLocked` to default to `true` (fail-closed) <!-- id: 9 -->
  - [ ] Implement `LockedModuleModal` in `NexusDashboard.jsx` triggered on locked card clicks <!-- id: 10 -->
  - [ ] Add route guard in `App.jsx` / `SIIFModule.jsx` to prevent direct URL access when locked <!-- id: 11 -->

- [ ] **Phase 4: Verification & Smoke Testing** <!-- id: 12 -->
  - [ ] Verify card visual state (grayscale, `Access Restricted 🔒`) <!-- id: 13 -->
  - [ ] Verify card click behavior (opens Maintenance / Lock Modal) <!-- id: 14 -->
  - [ ] Verify direct `/siif` navigation protection <!-- id: 15 -->
  - [ ] Run build test (`npm run build`) <!-- id: 16 -->
