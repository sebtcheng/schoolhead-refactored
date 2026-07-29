## 0. OBJECTIVE & NON-NEGOTIABLES

Five targeted revisions to the InsightED School Head PWA (`schoolhead-refactored`, HEAD `ac9ab47fa5543f9a34d15d9b50e5de214829e41d`): (R1) remove the sidebar from the InsightED Nexus welcome page; (R2) change the Cloud Hub Home tab to display the School Head Mission Control in-place instead of navigating back to the Nexus, and move the Go-Back-to-Nexus action to a dedicated button anchored at the bottom of the Cloud Hub sidebar; (R3) remove the Guide button and its content panel from the Cloud Hub; (R4) make the Cloud Hub sidebar render consistently and with the same active-item highlight regardless of which sidebar tab is selected; (R5) fix the broken InsightED logo image reference in the Cloud Hub sidebar.

**Preserve-list:** all existing API endpoint contracts (`/api/*`), auth middleware, JWT session logic, all 9 unit form wizards, offline/PWA sync logic (`Outbox`, `SyncCenter`, `sw.js`), SIIF module routes and `siifService.js` fetch contracts, `ProtectedRoute` role guards, `ThemeContext`/`AuthContext`/`ServiceWorkerContext`, the `SchoolHeadChatWidget`, and the global `App.jsx` shell structure.

**Single allowed exception:** the Nexus welcome page layout (R1) is structurally changed by removing its sidebar block; every other element on that page is preserved.

**Rule precedence for conflicts:** (a) preserve existing business logic → (b) apply existing design tokens/CSS → (c) layout changes in this prompt.

**Hard rules in full:** no guessing or inventing file paths, column names, or JSX; ground every instruction to real files/components from the synthesis; quote values verbatim; single source of truth; deterministic output; full-line diffs (no `...`, no markers, no prose stand-ins); missing anchor = `STOP AND ASK`.

---

## 0.1 EXECUTION PROTOCOL — MANDATORY PHASED FORCE-RUN

**Override notice:** The executing agent may NOT self-scope, reorder, cherry-pick, or stop early. Every revision must reach `DONE` or `BLOCKED` before the run closes.

**Anti-drift rules:**

- Implement every revision exactly as written.
- One item to completion before starting the next.
- No summarizing instead of editing — produce actual file diffs.
- Multi-copy edits (same hunk in N files) = one item but N separate diff blocks.
- Re-emit the full ledger at every phase boundary.
- Exit gates must cite observed grep counts or exact values, never "should work".
- Never fabricate to unblock — emit `STOP AND ASK:` instead.

**Run ledger template:**

| R# | Phase | Status | Evidence |
| --- | --- | --- | --- |
| R1 | P1 | PENDING | — |
| R2 | P2 | PENDING | — |
| R3 | P2 | PENDING | — |
| R4 | P3 | PENDING | — |
| R5 | P3 | PENDING | — |

**Phase map:**

| Phase | Name | Items | Exit gate |
| --- | --- | --- | --- |
| P0 | Grounding lock | — | All files named, HEAD `ac9ab47` confirmed, all ledger rows PENDING. Zero edits. |
| P1 | Nexus welcome sidebar removal | R1 | `grep -c "<aside\ |
| P2 | Cloud Hub content + Guide removal | R2, R3 | Home tab no longer calls `navigate('/nodes-dashboard')` — `grep -c "nodes-dashboard" <CloudHub home handler>` = 0; Guide button gone — `grep -c "Guide\ |
| P3 | Sidebar consistency + logo fix | R4, R5 | `grep -c "activeTab\ |
| P4 | Verification | all | Walk §5 checklist line by line with pass/fail. All ledger rows DONE or BLOCKED. `pnpm build` passes. |

**Phase Exit Report template (only way to close a phase):**

```
PHASE EXIT REPORT — P<n> <Name>
Items completed: R# list
Exit gate result: <exact grep output / observed value>
Ledger (full re-emit):
  R1 [phase] [STATUS] [evidence]
  R2 [phase] [STATUS] [evidence]
  R3 [phase] [STATUS] [evidence]
  R4 [phase] [STATUS] [evidence]
  R5 [phase] [STATUS] [evidence]
Next: proceed to P<n+1>
```

**BLOCKED-item protocol:** Name the missing artifact. Emit `STOP AND ASK: <exact missing value>`. Ship every non-blocked part of the item. Mark row `BLOCKED`.

**Hard failure conditions:** any row not `DONE`/`BLOCKED` at close; skipped phases; partial multi-copy edits; fabricated values; preserve-list breach.

**Context-exhaustion clause:** Finish current item, emit Phase Exit Report, state `RESUME AT: P<n>`. Never stop silently.

**Kickoff line:** Start now with P0. No approval pauses between phases.

---

## 1. TARGET CODEBASE MAP

**Repo:** `clea241/InsightEd-SchoolHead-Official-2.0` · branch `schoolhead-refactored` · HEAD `ac9ab47fa5543f9a34d15d9b50e5de214829e41d`

**Stack:** React 19 + Vite 7 PWA · pnpm@9 + Turborepo · Express 5 (ESM) · PostgreSQL · JWT auth

**Frontend root:** `apps/school-head/web/src/`

**Files to edit:**

| File | Role | Revision |
| --- | --- | --- |
| `NexusDashboard.jsx` (confirm exact path under `modules/` or `components/`) | `/nodes-dashboard` — InsightED Nexus welcome page | R1 |
| Cloud Hub sidebar component (confirm exact path — likely under `modules/` or `components/modular/`) | Cloud Hub left-rail nav | R2, R3, R4, R5 |
| Cloud Hub Home tab component (confirm exact path) | Home tab content rendered inside the Cloud Hub | R2 |

**Must NOT be modified:** all unit form wizards (`components/modular/Unit1*.jsx` … `Unit7*.jsx`); `App.jsx` routing table; `AuthContext`, `ThemeContext`, `ServiceWorkerContext`; `siifService.js`; any backend file under `apps/school-head/api/` or `apps/siif/api/`; offline/PWA logic (`sw.js`, `Outbox`, `SyncCenter`).

---

## 2. VERBATIM REFERENCE MATERIAL

### API URL helper

```jsx
// lib/api.js
api(path) // resolves to /insighted-schoolhead/api<path> (prod) or /api<path> (local)
// Use api() for all fetch calls; never hardcode /api directly.
```

### Role / auth constants

```jsx
// config/roleGroups.js
import { normalizeRole, ROLE_GROUP_MAP, NEXUS_AUTHORIZED_EMAILS } from '../config/roleGroups.js';
// ProtectedRoute gates by localStorage.userRole
```

### Routing table (relevant entries)

```jsx
// App.jsx AnimatedRoutes
<Route path="/nodes-dashboard"   element={<ProtectedRoute allowedRoles={['School Head']}><NexusDashboard /></ProtectedRoute>} />
<Route path="/modular-dashboard" element={<ProtectedRoute allowedRoles={['School Head']}><ModularDashboard /></ProtectedRoute>} />
```

### Navigation (React Router)

```jsx
import { useNavigate } from 'react-router-dom';
const navigate = useNavigate();
navigate('/nodes-dashboard');   // go to Nexus
navigate('/modular-dashboard'); // go to Modular Dashboard (Mission Control)
```

---

## 3. LAYOUT / INTERACTION CONTRACT

### R1 — Nexus welcome page: sidebar-free layout

- After removing the sidebar, the main content area of `NexusDashboard` must expand to full width (remove any `flex`/`grid` column split that existed to accommodate the sidebar).
- No new navigation is added; the page retains all other existing content (announcements, progress cards, etc.).

### R2 — Cloud Hub Home tab: Mission Control in-place

- The Home tab in the Cloud Hub sidebar, when clicked, must render the School Head Mission Control **inside the Cloud Hub layout** (same shell, same sidebar visible) — it must NOT call `navigate('/nodes-dashboard')` or any other full-page navigation.
- The Mission Control content to render is whatever component or JSX currently lives at `/modular-dashboard` (`ModularDashboard`), or a dedicated Mission Control sub-component if one exists — **STOP AND ASK** if the exact component/JSX to embed is ambiguous.
- The "Go Back to Nexus" action is moved to a `<button>` anchored at the **bottom** of the sidebar (`mt-auto` or equivalent), styled consistently with the sidebar's existing design tokens. It calls `navigate('/nodes-dashboard')`.

### R3 — Guide button: full removal

- Remove the Guide button element and its associated content panel (drawer, modal, or inline section — whichever form it takes) from the Cloud Hub sidebar or layout.
- Remove any state variable exclusively used to show/hide the Guide (e.g. `showGuide`, `guideOpen`) if it has no other consumers.

### R4 — Cloud Hub sidebar consistency

- The sidebar must accept an `activeTab` (or equivalent) prop and apply a consistent active-item highlight class to whichever tab is currently selected.
- Every Cloud Hub page/tab that renders the sidebar must pass the correct `activeTab` value matching its label.
- If the sidebar is duplicated across multiple page files (inline `<aside>` blocks), extract it into a single shared component and replace all inline copies with that component.

### R5 — InsightED logo fix

- The logo `<img>` or SVG reference in the Cloud Hub sidebar must resolve correctly in both dev and prod.
- If the logo is imported as a module (`import InsightEdLogo from '...'`), verify the import path resolves to an existing file under `apps/school-head/web/src/` or `public/`.
- If the path is a hardcoded string (e.g. `/insighted-schoolhead/assets/logo.png`), replace it with a Vite asset import or a `public/` relative path that exists in the repo.

---

## 4. NUMBERED REVISIONS

### R1 — Remove sidebar from InsightED Nexus welcome page

- **Where:** `NexusDashboard.jsx` (confirm exact path — likely `apps/school-head/web/src/modules/NexusDashboard.jsx` or `components/NexusDashboard.jsx`) :: sidebar `<aside>` block and wrapping layout container
- **Do:** Remove the `<aside>` sidebar element entirely. Remove any `flex`/`grid` wrapper that split the page into sidebar + content columns. Expand the content area to full width.
- **DIFF:**
    
    **STOP AND ASK:** Provide the exact file path of `NexusDashboard.jsx` and its full current JSX (especially the outer layout wrapper, the `<aside>` sidebar block, and the main content wrapper).
    
    Once confirmed, apply full-line unified diff:
    
    - Every `-` line of the `<aside>` block and any sidebar-specific state/import written in full.
    - The layout wrapper changes (`className` update to expand content) written as full `-`/`+` pairs.
    - If any state vars (`sidebarOpen`, `activeNavItem`, etc.) are exclusively used for the sidebar, remove them too.
- **Apply to:** single file
- **Data bindings:** none — purely presentational
- **Preserve:** all non-sidebar content in `NexusDashboard.jsx` (announcements, progress, school info cards); `<PageTransition>`; auth guard; `SchoolHeadChatWidget` if present.
- **Verify:** `grep -c "<aside\|sidebarOpen\|navItems" <confirmed NexusDashboard path>` decreases to 0 for sidebar-specific tokens; `pnpm build` passes.

---

### R2 — Cloud Hub Home tab: render Mission Control in-place; Go Back to Nexus at sidebar bottom

- **Where:**
    - Cloud Hub sidebar component (confirm exact path) :: Home nav item `onClick` handler
    - Cloud Hub sidebar component :: bottom section (for the new Go Back button)
    - Cloud Hub Home tab content component (confirm exact path) :: current render
- **Do:**
    - Change the Home tab `onClick` from `navigate('/nodes-dashboard')` (or equivalent) to setting the active tab state to render the Mission Control content inside the Cloud Hub shell.
    - In the Home tab content area, render `<ModularDashboard />` (or the correct Mission Control component — **STOP AND ASK** for the exact component if it is not `ModularDashboard`) inside the Cloud Hub layout, not via a route navigation.
    - Add a "Go Back to Nexus" `<button>` at the bottom of the sidebar (`mt-auto` block), calling `navigate('/nodes-dashboard')`. Style with the sidebar's existing muted/secondary style (not the primary active style).
    - Remove the previous Go Back to Nexus entry from wherever it currently lives in the sidebar nav list.
- **DIFF:**
    
    **STOP AND ASK:** (a) Confirm the exact file path of the Cloud Hub sidebar component. (b) Confirm the exact file path of the Cloud Hub Home tab content component. (c) Provide the current `onClick` handler for the Home nav item (full JSX line). (d) Provide the current location of the "Go Back to Nexus" control (exact JSX lines). (e) Confirm whether `ModularDashboard` is the correct component to embed as Mission Control, or provide the correct component name/path.
    
    Once confirmed, per file, apply full-line unified diff (zero ellipses, zero banned tokens), one diff block per file, each with `--- a/` / `+++ b/` headers and ≥ 3 verbatim context lines.
    
- **Apply to:** Cloud Hub sidebar file + Cloud Hub Home content file (two diff blocks minimum)
- **Data bindings:** `navigate` from `react-router-dom`; active-tab state variable (confirm name)
- **Preserve:** all other sidebar nav items and their handlers; Mission Control / ModularDashboard internal logic untouched; no change to the `/modular-dashboard` route itself.
- **Verify:** `grep -c "navigate.*nodes-dashboard" <CloudHub sidebar file>` = 0 (Home tab no longer navigates away); `grep -c "nodes-dashboard" <CloudHub sidebar file>` = 1 (only the Go Back button retains it).

---

### R3 — Remove Guide button and content from Cloud Hub

- **Where:** Cloud Hub sidebar component (confirm exact path) :: Guide button element and Guide content panel
- **Do:** Delete the Guide `<button>` element. Delete its associated content panel (drawer, modal, or inline section). Remove any state variable exclusively used to toggle the Guide (e.g. `showGuide`, `guideOpen`, `isGuideOpen`).
- **DIFF:**
    
    **STOP AND ASK:** Provide the exact current JSX of the Guide button and its content panel (full lines, no ellipses), and the name of any state variable that controls it.
    
    Once confirmed, apply full-line unified diff:
    
    - Every `-` line of the Guide button written in full.
    - Every `-` line of the Guide content panel written in full.
    - The `const [showGuide, setShowGuide] = useState(false)` (or equivalent) line prefixed `-` in full.
- **Apply to:** single file (Cloud Hub sidebar/layout component)
- **Data bindings:** none
- **Preserve:** all other sidebar nav items, overlay/modal logic unrelated to Guide.
- **Verify:** `grep -c "Guide\|guide\|showGuide\|guideOpen" <CloudHub sidebar file>` = 0.

---

### R4 — Cloud Hub sidebar: consistent active-item highlight across all tabs

- **Where:** Cloud Hub sidebar component (confirm exact path) :: nav item render and active-state logic; every Cloud Hub page/tab that instantiates the sidebar
- **Do:**
    - Ensure the sidebar component accepts an `activeTab` prop (or uses a shared context/state) and applies a consistent CSS active class to the matching nav item.
    - If the sidebar is rendered as inline `<aside>` markup in multiple page files, extract it into a single `CloudHubSidebar.jsx` component (under `components/` or `modules/shared/`) and replace every inline copy with `<CloudHubSidebar activeTab="<label>" />`.
    - If the sidebar is already a shared component but the `activeTab` prop is missing or inconsistently passed, add/correct the prop at every call site.
- **DIFF:**
    
    **STOP AND ASK:** (a) List every file that renders the Cloud Hub sidebar (inline or as a component). (b) For each file, provide the current `<aside>` or `<CloudHubSidebar ...>` invocation line. (c) Provide the current nav-item render loop or list with its active-state logic (full lines).
    
    Once confirmed:
    
    - If extraction is needed: emit the new `CloudHubSidebar.jsx` file in full (new file — complete content including imports and exports, not a diff).
    - For each call site file: one full-line unified diff block replacing the inline `<aside>` with `<CloudHubSidebar activeTab="<label>" />`.
    - Each diff block has its own `--- a/` / `+++ b/` headers and ≥ 3 verbatim context lines.
- **Apply to:** Cloud Hub sidebar file + every Cloud Hub page that uses it (one diff block per file)
- **Data bindings:** none — purely presentational
- **Preserve:** all `onClick` handlers on nav items; all routing/navigation calls; all other page content outside the sidebar.
- **Verify:** `grep -c "activeTab\|activeLabel" <CloudHub sidebar file>` ≥ 1; navigating to each Cloud Hub tab shows the correct item highlighted.

---

### R5 — Fix broken InsightED logo in Cloud Hub sidebar

- **Where:** Cloud Hub sidebar component (confirm exact path) :: logo `<img>` element or SVG reference
- **Do:** Correct the logo import or `src` path so the logo resolves in both dev and prod builds. Use a Vite asset import (`import logo from '../assets/logo.png'` or equivalent) rather than a hardcoded string if the file lives under `src/`. If the logo lives under `public/`, use a path relative to the Vite `base` (e.g. `${import.meta.env.BASE_URL}logo.png`).
- **DIFF:**
    
    **STOP AND ASK:** (a) Provide the exact current logo line in the Cloud Hub sidebar (the full `import` statement if module import, or the full `<img src=...>` line). (b) Confirm whether the logo file exists under `src/assets/`, `public/`, or another path, and provide its exact relative path from the repo root.
    
    Once confirmed:
    

```diff
--- a/<confirmed Cloud Hub sidebar path>
+++ b/<confirmed Cloud Hub sidebar path>
@@ component: <ComponentName> -> logo import or img src @@
-import InsightEdLogo from '<current broken path>';
+import InsightEdLogo from '<correct resolved path>';
```

Or if it is an inline `src` string:

```diff
--- a/<confirmed Cloud Hub sidebar path>
+++ b/<confirmed Cloud Hub sidebar path>
@@ component: <ComponentName> -> logo img element @@
-  <img src="<current broken src>" alt="InsightED" className="<verbatim classes>" />
+  <img src={`${import.meta.env.BASE_URL}<correct filename>`} alt="InsightED" className="<verbatim classes>" />
```

- **Apply to:** single file (Cloud Hub sidebar)
- **Data bindings:** Vite `import.meta.env.BASE_URL` (= `/insighted-schoolhead/` in prod, `/` in local dev)
- **Preserve:** `alt` text, `className`, all other `<img>` props bit-for-bit.
- **Verify:** `grep -c "InsightEdLogo\|logo.*src\|BASE_URL.*logo" <CloudHub sidebar file>` ≥ 1 with a valid resolved path; logo renders in both `pnpm dev` and `pnpm build` preview.

---

## 5. CONFLICT-PREVENTION CHECKLIST

- [ ]  R1 removes only the sidebar block from `NexusDashboard.jsx` — no other page is affected.
- [ ]  R2 Home tab renders Mission Control inside the Cloud Hub shell — the `/nodes-dashboard` and `/modular-dashboard` routes in `App.jsx` are not modified.
- [ ]  R2 Go Back to Nexus button calls `navigate('/nodes-dashboard')` — the same target as before, just repositioned.
- [ ]  R3 removes only Guide-specific JSX and its exclusive state variable — no other modal/overlay logic is touched.
- [ ]  R4 sidebar extraction (if needed) replaces every inline `<aside>` copy with the shared component — no inline `<aside>` sidebar blocks remain.
- [ ]  R4 active-highlight logic does not change any `onClick` handler or navigation target.
- [ ]  R5 logo fix uses an import or `BASE_URL`-relative path — no hardcoded absolute URL.
- [ ]  No backend file is modified by any revision.
- [ ]  `pnpm build` passes after all revisions (`pnpm lint` may also be run).
- [ ]  All API calls in the Cloud Hub pages continue to use `api()` from `lib/api.js` — no fetch URL is changed.

---

## 6. ACCEPTANCE CRITERIA

1. **Nexus welcome (R1):** Navigating to `/nodes-dashboard` shows a full-width page with no sidebar. All other Nexus content is intact.
2. **Cloud Hub Home tab (R2):** Clicking the Home tab in the Cloud Hub sidebar renders the Mission Control content inside the Cloud Hub layout — the sidebar remains visible and the URL does not change to `/nodes-dashboard`. A "Go Back to Nexus" button is visible at the bottom of the sidebar and navigates to `/nodes-dashboard` when clicked.
3. **Guide removed (R3):** No Guide button or Guide content panel is visible anywhere in the Cloud Hub. `grep -c "Guide\|showGuide" <sidebar file>` = 0.
4. **Sidebar consistency (R4):** Clicking any Cloud Hub sidebar tab highlights that tab and only that tab. The highlight is identical in style across all tabs. If the sidebar was previously duplicated, one canonical `CloudHubSidebar` component is now the sole render path.
5. **Logo fixed (R5):** The InsightED logo displays correctly in the Cloud Hub sidebar in both development (`pnpm dev`) and production (`pnpm build` + preview) without a broken-image icon.
6. **No regressions:** `pnpm build` passes; no console errors on any school-head route; all unit form wizards, SIIF module, and offline/PWA sync are unaffected.