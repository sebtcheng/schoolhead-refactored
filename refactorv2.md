<aside>
⚡

Execute-verbatim implementation prompt. Paste the section below into your coding agent as-is. **Source of truth = the `main` branch** of `clea241/InsightEd-SchoolHead-Official-2.0` (pinned commit `16bb5dfc6e8ccdd01644e892ab47dfed21b6c5bc`). Goal: reapply that exact styling layer into the current `schoolhead-refactored` branch (commit `a481ed3`). All design values below are copied verbatim from `main` — there are no unresolved STOP AND ASK items.

</aside>

# 0. OBJECTIVE & NON-NEGOTIABLES

**Scope (one line):** Port and reapply the complete CSS / styling layer that renders correctly on the **`main`** branch into the current **`schoolhead-refactored`** branch, so every view matches the InsightED design system — with **zero** changes to application logic, data, or contracts.

**Critical structural fact (read first):** `main` and `schoolhead-refactored` do NOT share the same file layout. This is a **port-and-remap**, not a raw file copy.

- `main` is a **flat single-app** Vite project: source lives at `src/…`; build config (`tailwind.config.js`, `postcss.config.js`, `index.html`, `vite.config.js`) sits at the **repo root**.
- `schoolhead-refactored` is a **pnpm + Turborepo monorepo**: the School Head web app lives at `apps/school-head/web/…` with shared packages under `packages/*`.

Copy the *styling values and rules* from `main` verbatim, but place them at the **refactored** branch's equivalent paths (see §1 mapping). Never restructure the monorepo to match `main`.

**Preserve-list (must NOT change):**

- All backend code under `apps/school-head/api`, `apps/siif/api`, and `packages/shared-*` (routers, middleware, DB layer). CSS work is frontend-only.
- All React component logic, hooks, state, effects, and routing (`App.jsx`, `HashRouter`, `ProtectedRoute`, `AnimatedRoutes`).
- All API calls and the `lib/api.js` `api(path)` base resolution (`/insighted-schoolhead/api` prod, `/api` local, `VITE_API_URL` override). Note: `main` uses a different base (`/insighted-staging`, see its `src/main.jsx` fetch interceptor) — **do NOT port main's base path or fetch interceptor**; keep the refactored branch's resolution untouched.
- All data bindings, response shapes, and endpoints (`/api/*`, `/siif/*`).
- The SIIF rule: no `fetch` in components; all calls stay in `services/siifService.js`.
- Any `className` / `id` / `data-*` attribute that JavaScript reads or that drives conditional behavior — do not rename these unless the corresponding JS/JSX selector is updated in the same edit.
- PWA / offline behavior (`sw.js`, `db.js`, `Outbox`, `SyncCenter`), `ThemeContext` semantics, `vite.config.js` `base` path (`/insighted-schoolhead/`).

**Single allowed exception:** Only styling artifacts may change — `.css` files, Tailwind config + utility classes, design-token declarations, and JSX `className`/inline-`style` attributes *strictly for presentation*.

**Hard rules (obey):**

1. **Values are provided verbatim in §2 — use them exactly.** Copy hex, spacing, radius, fonts, shadows, and gradients as written from `main`. Do not invent, round, or substitute. If a class exists on `main` but its target JSX on the refactored branch is unclear, insert a bold `NOTE:` and continue.
2. **Ground everything** in the `main`-branch files cited in §1/§2. No generic "clean up the styles" advice.
3. **Quote references verbatim** from §2. Paste exact tokens/CSS; never paraphrase.
4. **Preserve, don't break** — keep all logic, contracts, selectors, and route/tab keys per the preserve-list. Styling is the ONLY allowed change.
5. **Single source of truth** — one canonical token set in the global stylesheet; every view consumes it. SIIF keeps its own scoped token mirror (`.siif-module-root`) exactly as on `main`.
6. **Rule precedence for conflicts:** (a) preserve logic/selectors → (b) apply the `main` global token layer → (c) module-scoped rules (SIIF) override global where `main` scopes them under `.siif-module-root`.
7. **Full coverage** — the one REVISION maps to exactly task R1 below; nothing dropped, nothing invented.
8. **Deterministic output** — imperative and specific. Exact values in code blocks. Inline code for short snippets; never nest fenced code blocks.

---

# 1. SOURCE ↔ TARGET PATH MAP

*(left = verbatim source on `main` @ `16bb5df`; right = where it belongs on `schoolhead-refactored` @ `a481ed3`)*

| Concern | `main` (source of truth) | `schoolhead-refactored` (target) |
| --- | --- | --- |
| Tailwind config | `/tailwind.config.js` (repo root) | `apps/school-head/web/tailwind.config.js` — confirm exact path; create/repair if missing |
| PostCSS config | `/postcss.config.js` (repo root) | `apps/school-head/web/postcss.config.js` |
| Global stylesheet + token layer | `src/index.css` | `apps/school-head/web/src/index.css` (imported once in `main.jsx`) |
| Stylesheet import site | `src/main.jsx` → `import './index.css'` | `apps/school-head/web/src/main.jsx` — verify the import exists and resolves |
| Global sidebar / app shell | `src/components/SharedNexusSidebar.jsx` (inline `<style>`) + `src/App.jsx` | `apps/school-head/web/src` shell (`App.jsx` → `AppContent`) + shared-ui |
| SIIF module stylesheet | `src/modules/siif/styles/siif.css` (single file, scoped `.siif-module-root`) | `apps/school-head/web/src/modules/siif/styles/siif.css` |

**Styling stack on `main` (replicate this exactly):** Tailwind CSS v3 utility classes + a **CSS-variables token layer** declared in `src/index.css` `:root` and mirrored into `tailwind.config.js` → `theme.extend.colors`. PostCSS runs `tailwindcss` + `autoprefixer`. `darkMode: 'class'`. There are **no** CSS Modules, SCSS, or CSS-in-JS libraries — the only inline `<style>` is inside `SharedNexusSidebar.jsx`, and SIIF ships one plain `.css` file.

<aside>
🧭

**Root-cause hypothesis (Reference D):** nav labels concatenate with no spacing → the Tailwind pipeline / global `index.css` is not loading on the refactored branch. Most likely: `index.css` is not imported in the app's `main.jsx`, or `tailwind.config.js` `content` globs don't cover `apps/school-head/web` so all utility classes are purged, or PostCSS isn't wired. Verify these three before any per-view work.

</aside>

---

# 2. VERBATIM REFERENCE MATERIAL (copied from `main`)

## 2.1 — InsightED design tokens · `src/index.css` `:root`

```css
:root {
  /* InsightED Core Palette */
  --navy: #08315F;
  --blue: #075985;
  --blue-600: #0284C7;
  --blue-400: #7DD3FC;
  --blue-100: #E0F2FE;
  --blue-50: #F0F9FF;
  --gold: #FBBF24;
  --amber: #D97706;
  --red: #B91C1C;
  --green: #16A34A;
  --purple: #7C3AED;
  --card: #FFFFFF;
  --text: #0F172A;
  --muted: #64748B;
  --line: #BAE6FD;
  --font-heading: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-body: "DM Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --radius: 22px;
  /* Legacy fallbacks (keep to avoid breaking auth/old modules) */
  --engineer-navy: #003366;  --engineer-slate: #1e293b;  --engineer-orange: #f97316;
  --engineer-yellow: #fbbf24; --engineer-dark: #0f172a;  --engineer-zinc: #71717a;
  --engineer-border: #e2e8f0;
}
```

Font imports at the very top of `index.css` (keep verbatim): Google Fonts `DM Sans`, `Plus Jakarta Sans`, and `Poppins`.

## 2.2 — Tailwind theme extension · `tailwind.config.js`

```jsx
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"], // RETARGET globs to apps/school-head/web on refactored
  theme: { extend: {
    colors: {
      'deped-blue': '#10346B', 'deped-blue-dk': '#002580', 'deped-red': '#CE1126', 'deped-gold': '#FCD116',
      'siif-blue': '#0e83bd', 'siif-gray': '#b3b3b3', 'siif-yellow': '#ffd93b', 'surface': '#fafbff',
      navy: 'var(--navy)', blue: 'var(--blue)', 'blue-600': 'var(--blue-600)', 'blue-400': 'var(--blue-400)',
      'blue-100': 'var(--blue-100)', 'blue-50': 'var(--blue-50)', gold: 'var(--gold)', amber: 'var(--amber)',
      red: 'var(--red)', green: 'var(--green)', purple: 'var(--purple)', card: 'var(--card)',
      text: 'var(--text)', muted: 'var(--muted)', line: 'var(--line)',
    },
    fontFamily: { sans: ['Poppins', 'sans-serif'], heading: 'var(--font-heading)', body: 'var(--font-body)' },
    borderRadius: { 'siif': 'var(--radius)' },
    animation: { blob:'blob 7s infinite', 'gradient-xy':'gradient-xy 15s ease infinite', 'pop-up':'pop-up 0.5s ease-out forwards', shimmer:'shimmer 2s infinite', 'pulse-subtle':'pulse-subtle 3s ease-in-out infinite' },
    // keyframes: blob, gradient-xy, pop-up, shimmer, pulse-subtle — copy verbatim from main
  }},
  plugins: [],
}
```

**⚠️ On the refactored branch, the `content` globs MUST cover the app source** (e.g. `"./index.html"`, `"./src/**/*.{js,ts,jsx,tsx}"` relative to `apps/school-head/web`, plus any consumed `packages/**`). Wrong globs = Tailwind purges every class = the Reference D symptom.

## 2.3 — PostCSS · `postcss.config.js`

```jsx
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

## 2.4 — Global body + typography · `src/index.css`

```css
@tailwind base; @tailwind components; @tailwind utilities;
body {
  margin: 0; min-height: 100vh; color: var(--text); font-family: var(--font-body);
  background-color: var(--blue-50); background-attachment: fixed;
  background-image:
    radial-gradient(43.5% 49.5% at 10% 12%, rgba(7,89,133,.30) 0 34%, transparent 78%),
    radial-gradient(46.5% 54% at 92% 10%, rgba(251,191,36,.42) 0 36%, transparent 80%),
    radial-gradient(40.5% 48% at 84% 92%, rgba(125,211,252,.30) 0 34%, transparent 78%),
    radial-gradient(45% 52.5% at 8% 92%, rgba(217,119,6,.26) 0 28%, rgba(251,191,36,.18) 42%, transparent 80%);
}
h1,h2,h3,h4,h5,h6 { font-family: var(--font-heading); }
```

`index.css` also carries (port verbatim, do not trim): `.dark` overrides, auth-screen light-mode overrides (`.login-container`/`.register-container`), redesign animations (`blob`, `gradient-xy`, `shimmer`, `pulse-subtle`, `float`, wave `.parallax`), the `.bg-canvas`/`.bg-yellow-glow`/`.bg-contours` blueprint background system, custom scrollbars, and `.auth-register-embedded` form styling.

## 2.5 — SIIF scoped tokens + core layout · `src/modules/siif/styles/siif.css`

SIIF **redeclares the same tokens** under `.siif-module-root` (plus `--bg:#F0F9FF`) so the module is self-contained. Key layout classes (copy verbatim):

```css
.siif-app-layout { display: grid; grid-template-columns: 72px 1fr; min-height: 100vh; }
@media (max-width: 1000px) { .siif-app-layout { grid-template-columns: 1fr; } }
.siif-sidebar { color:#fff; padding:24px; display:flex; flex-direction:column; gap:28px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--navy) 92%, transparent), color-mix(in srgb, var(--blue) 72%, var(--navy) 28%));
  border-right:1px solid rgba(255,255,255,.24); box-shadow:18px 0 42px rgba(11,31,77,.16); overflow:hidden; }
@media (min-width:1001px){ .siif-sidebar{ width:72px; transition:width .18s ease; } .siif-sidebar:hover{ width:260px; } }
.siif-nav a { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:14px;
  font-size:14px; font-weight:700; color:rgba(255,255,255,.78); text-decoration:none; border:1px solid transparent; }
.siif-nav a.active { background:rgba(255,255,255,.16); color:#fff; border-color:rgba(255,255,255,.28);
  box-shadow: inset 0 -3px 0 var(--gold), 0 0 18px color-mix(in srgb, var(--blue-400) 26%, transparent); }
.siif-card { background:var(--card); border:2.5px solid color-mix(in srgb, var(--blue) 64%, var(--navy) 36%);
  border-radius:var(--radius); box-shadow:none; font-family:var(--font-body); }
.siif-topbar { display:flex; justify-content:space-between; align-items:center; gap:25px; min-height:130px;
  padding:28px 44px; border:2.5px solid color-mix(in srgb, var(--blue) 64%, var(--navy) 36%);
  background:linear-gradient(135deg, var(--blue-50), white); box-shadow:0 16px 34px color-mix(in srgb, var(--navy) 12%, transparent);
  border-radius:0 0 22px 22px; overflow:hidden; }
.siif-topbar .eyebrow { color:var(--gold); font-size:14px; font-weight:900; letter-spacing:.2em; text-transform:uppercase; }
.siif-topbar h1 { font-family:var(--font-heading); font-size:40px; font-weight:900; color:var(--blue); }
```

**KPI / allocation value colors (verbatim):** progress fill `linear-gradient(90deg, var(--navy), var(--blue-600))`; legend dots `.siif-dot.sky → var(--blue-600) #0284C7`, `.siif-dot.green → var(--green) #16A34A`, `.siif-dot.gold → var(--gold) #FBBF24`; big number `.siif-big-number` uses `var(--navy)`. Status pills: `ok #DCFCE7/#166534`, `warn #FEF3C7/#92400E`, `risk #FEE2E2/#991B1B`, `info #DBEAFE/#1E40AF`. Port the full `html.dark .siif-*` dark-mode block verbatim too.

## 2.6 — Global sidebar shell · `SharedNexusSidebar.jsx` inline `<style>`

```css
.nodes-sidebar { width:80px; position:fixed; inset:0 auto 0 0; color:#fff; padding:24px 8px;
  display:flex; flex-direction:column; align-items:center; gap:28px;
  background: linear-gradient(180deg, color-mix(in srgb, #06345F 92%, transparent), color-mix(in srgb, #0A6FA6 72%, #06345F 28%));
  border-right:1px solid rgba(255,255,255,.24); box-shadow:18px 0 42px rgba(11,31,77,.16); overflow:hidden; z-index:100; }
@media (max-width:1023px){ .nodes-sidebar{ display:none !important; } } /* mobile → grid-cols-5 bottom nav */
.nodes-sidebar:hover, .nodes-sidebar.sidebar-expanded { width:260px !important; padding:24px 16px; align-items:flex-start; }
.nodes-nav button { display:flex; align-items:center; justify-content:center; width:44px; height:44px;
  border-radius:14px; color:rgba(255,255,255,.78); border:1px solid transparent; gap:12px; background:transparent; }
.nodes-nav button.active { background:rgba(255,255,255,.16) !important; color:#fff !important;
  border-color:rgba(255,255,255,.28) !important; box-shadow: inset 0 -3px 0 #FDBA22, 0 0 18px color-mix(in srgb, #0A6FA6 26%, transparent) !important; }
```

Nav items on `main`: `Home` (`/nodes-dashboard`), `CLOUD` (`/my-activity`), `Units` (`/modular-dashboard`), `Guide` (`/guide/school-head`), `Settings` (`/profile`). Active icon tint `#FBBF24`; footer shows `SCHOOL HEAD` / school name / `Secure Sign Out`. Match the refactored branch's own route keys — **do not change routes**, only styling.

---

## Broken-state evidence (current `schoolhead-refactored` render)

Screenshots document the *symptoms to fix*; the exact values to apply come from §2 (`main`).

**Reference A — SIIF School Head Dashboard (`/siif` → `SIIFDashboard`)**

!Broken SIIF dashboard — KPI cards render as flat unstyled boxes

Broken SIIF dashboard — KPI cards render as flat unstyled boxes

- Symptom: KPI cards are full-width flat rows with no grid/spacing/shadow. Fix source: `.siif-card`, `.siif-topbar`, allocation/progress classes in §2.5.

**Reference B — InsightED Nexus Gateway (`/nodes-dashboard` → `NexusDashboard`)**

!Broken Nexus gateway — portal cards unstyled

Broken Nexus gateway — portal cards unstyled

- Symptom: portal cards lack elevation/hover + `ACCESS RESTRICTED` disabled treatment. Fix source: token layer + Tailwind utilities restored.

**Reference C — STRIDE Action Board / Mission Control**

!Broken STRIDE mission control — overflowing, clipped, misaligned layout

Broken STRIDE mission control — overflowing, clipped, misaligned layout

- Symptom: content overflows / clips / misaligns — most severely broken view. Fix source: restore Tailwind layout utilities + container widths (this collapses when Tailwind is purged).

**Reference D — Collapsed / unstyled sidebar shell**

!Broken shell — nav labels concatenated with no spacing

Broken shell — nav labels concatenated with no spacing

- Symptom: `DUnitsGuideSettings` — no spacing/icons → **global stylesheet + Tailwind pipeline not loading**. Fix source: §1 callout (import site + content globs + PostCSS).

---

# 3. LAYOUT / INTERACTION CONTRACT (as rendered on `main`)

- **Global sidebar** (`.nodes-sidebar`): fixed left, **80px collapsed → 260px on hover/`.sidebar-expanded`**, navy gradient, icon+label rows, gold active underline (`inset 0 -3px 0 #FBBF24`), logo swap collapsed/expanded, hidden `< 1024px` (replaced by a 5-column bottom nav).
- **SIIF layout** (`.siif-app-layout`): CSS grid `72px 1fr` desktop → single column `< 1000px`; SIIF sidebar `72px → 260px` on hover; fixed bottom nav on mobile.
- **Header band** (`.siif-topbar`): min-height 130px, clip-path navy wedge (`::before`) + gold orb (`::after`), gold uppercase `.eyebrow` → 40px `h1`.
- **KPI / allocation**: elevated `.siif-card` (2.5px blue↔navy mixed border, radius `var(--radius)` = 22px, no shadow); progress bar `navy→blue-600`; legend dots sky/green/gold as in §2.5.
- **Cards & tables**: `.siif-card`, `.siif-table` (uppercase muted headers, centered cells, status pills), all consuming the token layer.
- **Dark mode**: class-based (`darkMode:'class'`); port both the global `.dark` block and the `html.dark .siif-*` block verbatim.

---

# 4. NUMBERED REVISIONS

## R1 — Reapply the `main`-branch CSS into `schoolhead-refactored`

**Where:** the styling stack mapped in §1 (`tailwind.config.js`, `postcss.config.js`, `src/index.css`, `src/main.jsx` import, `SharedNexusSidebar` shell, `modules/siif/styles/siif.css`) at their **refactored-branch** locations.

**Do (ordered):**

1. **Fix the pipeline first (root cause of Reference D).** Confirm on the refactored branch: (a) `index.css` is imported exactly once in the app entry (`main.jsx`); (b) `tailwind.config.js` `content` globs cover `apps/school-head/web` source (and any consumed `packages/**`) so classes aren't purged; (c) `postcss.config.js` runs `tailwindcss` + `autoprefixer`. Do NOT touch the Vite `base` (`/insighted-schoolhead/`).
2. **Restore the token layer** — paste the §2.1 `:root` variables and font imports into the app's `index.css`, and the §2.2 `theme.extend` (colors/fonts/radius/animations + keyframes) into the app's `tailwind.config.js`. This is the single source of truth.
3. **Restore global body + shared styles** — §2.4 body background/typography plus the `.dark`, auth-override, animation, `.bg-canvas`, scrollbar, and `.auth-register-embedded` blocks from `main`'s `index.css`, verbatim.
4. **Restore the app shell / sidebar** — reapply the §2.6 `.nodes-sidebar` styling (and its mobile bottom-nav) onto the refactored shell, keeping the refactored branch's own routes/selectors.
5. **Restore the SIIF module** (Reference A) — port `modules/siif/styles/siif.css` verbatim (scoped `.siif-module-root` tokens, `.siif-app-layout`, `.siif-sidebar`, `.siif-topbar`, `.siif-card`, allocation/progress, table, and full dark-mode block). Ensure it is imported by the SIIF module entry as on `main`.
6. **Restore the Nexus gateway** (Reference B) — with the token layer + Tailwind utilities back, verify portal card elevation/hover and `ACCESS RESTRICTED` disabled treatment render.
7. **Restore the STRIDE mission-control view** (Reference C) — confirm overflow/clipping is gone once Tailwind layout utilities resolve; contain panels at target breakpoints.
8. **Sweep remaining views** — Units 1–9 wizards, `ModularDashboard`, `MyActivityDashboard`, `AdminDashboard`, `Leaderboard`, `SyncCenter`, SIIF sub-pages — each must consume the single token source (rule 5).

**Data bindings:** none — presentation only. `NOTE:` if any styling fix appears to require touching a JS-consumed selector; surface the selector and its JS reference instead of renaming silently.

**Preserve (here):** every item in the §0 preserve-list. Do not port `main`'s staging `base`/fetch interceptor. Do not alter values shown in the screenshots (they are live data like `₱0.00` / `0%`).

---

# 5. CONFLICT-PREVENTION CHECKLIST

- [ ]  `index.css` imported once in the app entry; Tailwind `content` globs cover `apps/school-head/web`; PostCSS wired (Reference D resolved).
- [ ]  Vite `base` unchanged (`/insighted-schoolhead/`); CSS assets resolve, no 404s.
- [ ]  `main`'s staging base path / fetch interceptor NOT ported.
- [ ]  One canonical `:root` token set; SIIF `.siif-module-root` mirror matches `main`; no stray hardcoded colors.
- [ ]  Token hex, radius (22px), fonts (Plus Jakarta Sans / DM Sans / Poppins) match §2 verbatim.
- [ ]  No endpoint, route key, DB, or `lib/api.js` logic changed.
- [ ]  No JS-consumed `className`/`id`/`data-*` renamed without updating its JS reference in the same edit.
- [ ]  SIIF `fetch`-in-`siifService.js` rule intact; no fetch added to components.
- [ ]  PWA/offline (`sw.js`, `Outbox`, `SyncCenter`) untouched.
- [ ]  Global + SIIF dark-mode blocks ported verbatim.
- [ ]  STRIDE mission-control view has no overflow/clipping at target breakpoints.

# 6. ACCEPTANCE CRITERIA

- All four reference views (A–D) render matching the **`main`** branch: navy sidebar (80→260px hover) with gold active underline, header bands, elevated KPI/portal cards, no overflow/clipping, no concatenated nav labels.
- Every color/spacing/typography value derives from the single token source and matches the §2 verbatim values from `main`.
- Zero changes to logic, routes, endpoints, DB, API resolution, PWA/offline behavior, or JS-consumed selectors — verified by diff review (styling-only).
- The app builds and runs under `base` `/insighted-schoolhead/` with no CSS asset 404s and no Tailwind purge of used classes.
- Light and dark modes both render correctly (class-based `darkMode`).