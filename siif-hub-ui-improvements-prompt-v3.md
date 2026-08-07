# Implementation Prompt: SIIF Hub Aesthetic Mobile Overhaul & Non-Linear UX (v3)

## 1. Feature Summary
This implementation plan guides a visual, tactile, and structural layout redesign of all card modules in the School Innovation and Improvement Fund (SIIF) Forms Hub. The core objective is to move away from standard, boring, linear grey-box lists and implement modern, engaging, mobile-first card designs. 

By applying modern mobile UI/UX paradigms—such as asymmetrical bento-grid cells, interactive visual selection states (glow borders, micro-scale shifts), physical 3D depths, color-coded left-accent ribbons based on outcome categories, and a swipeable horizontal outcome carousel—we will create an interface that feels like a native mobile app. This overhaul is strictly frontend-only, preserving all existing local states, hook integrations, array handlers, and local IndexedDB database sync logic across both twins in the monorepo.

---

## 2. Verified Facts
- **SIIF Dual App Locations** — Mymmetrical edits must be synchronized across both independent app frontend directories:
  - Location A: `apps/school-head/web/src/modules/siif/` — Source: Verified — Feature / Surface Registry
  - Location B: `apps/siif/web/src/` — Source: Verified — Feature / Surface Registry
- **File Assets and Sub-Cards** — The card modules mapped directly in the route ledger are:
  - `pages/SIIFFormsHub.jsx` (Main controller wrapper) — Source: Verified — Route -> Component Map [54]
  - `pages/cards/PriorityImprovementAreaCard.jsx` (Priority Area cards) — Source: Verified — Route -> Component Map [54]
  - `pages/cards/InterventionsCard.jsx` (Checkable intervention row cards) — Source: Verified — Route -> Component Map [54]
  - `pages/cards/BeneficiariesCard.jsx` (Target grade & learners count blocks) — Source: Verified — Route -> Component Map [54]
  - `pages/cards/BudgetCard.jsx` (Budget entry fields and allocation charts) — Source: Verified — Route -> Component Map [54]
  - `pages/cards/ActivitiesCard.jsx` (Planned activities checkbox grid) — Source: Verified — Route -> Component Map [54]
- **Enums & Icon Constants** — The key UI descriptors and constants reside inside:
  - `constants/siifConstants.jsx` (exports: `INTERVENTIONS`, `INTERVENTION_ICONS`, `KEY_STAGES`, `GRADE_LABELS`, `SIP_AIP_ACTIVITIES`, `REMAINING_ACTIVITIES`) — Source: Verified — Symbol Ownership Registry
- **CSS Stylesheets** — The visual class declarations should use Tailwind CSS utilities in the component files and custom animation/shadow overrides inside:
  - `styles/siif.css` (or `apps/siif/web/src/styles/siif.css`) — Source: Verified — File Ledger [7, L7]

---

## 3. Assumptions and Unknowns

### Likely
- The transparent outlined headings use utility classes or custom `-webkit-text-stroke` properties in `siif.css` that will be completely replaced with solid, high-density filled Tailwind typography classes (such as `text-slate-900 font-extrabold tracking-tight`).
- Swapping horizontal text-heavy lists and complex tables (such as grade grids) for vertical stacked grids and bento cells will prevent horizontal mobile overflow, locking the layout tightly to mobile viewports.
- The UI framework is standard React 18 with Tailwind CSS v3, supporting layout classes like `grid-cols-2`, `aspect-square`, `backdrop-blur-sm`, and custom keyframe animations.

### Unknown
- The screen heights of user phones will vary. To avoid screen boundaries trapping content or cutting off CTA buttons, the bottom navigation button must float cleanly in a fixed, sticky container that does not obscure form fields.
- The precise state variables for dragging are defined locally in each file. The reorder execution will use HTML5 drag-and-drop reactive state operations directly in memory.

---

## 4. Affected Surfaces
| Surface | Status | Expected Role | Blueprint Source |
|---|---|---|---|
| `SIIFFormsHub.jsx` (both locations) | Verified | Wrap all sub-forms in a centered max-width column wrapper. Consolidate layout headers to render exactly one main solid title. Provide sliding bottom sheets for detail options. | Route -> Component Map [54] |
| `PriorityImprovementAreaCard.jsx` (both locations) | Verified | Refactor category selection into a horizontal swipeable outcome carousel. Implement color-coded left-accent strips, 3D floating scales for active drags, and micro-animations. | Route -> Component Map [54] |
| `InterventionsCard.jsx` (both locations) | Verified | Overhaul checkbox lists to "Selection Pods" with subtle background glows, active border scales, and animated checkmarks. | Route -> Component Map [54] |
| `BeneficiariesCard.jsx` (both locations) | Verified | Convert linear grade forms into double-column grid items. Setup vertical stacked count sections with clean tap input boxes. | Route -> Component Map [54] |
| `BudgetCard.jsx` (both locations) | Verified | Establish an asymmetrical "Bento Dashboard" card layout showing Remaining/Estimated values. Verticalize budget cost fields with peso prefixes and numeric keypad modes. | Route -> Component Map [54] |
| `ActivitiesCard.jsx` (both locations) | Verified | Clean activity row cards, utilizing distinct colored side borders and high-contrast category text markers. | Route -> Component Map [54] |
| `siif.css` (both locations) | Verified | Declare custom keyframe transitions, smooth height animations (`animate-slide-up`), and tactile dual-shadow ring classes. | File Ledger [7, L7] |

---

## 5. Data Model and Contract Requirements
- **Strict Payload Parity** — All visual refactoring is pure presentation logic. Do NOT alter local state data shapes or object properties. Reordered `draftPIAs` arrays, checked `selectedInterventions` arrays, and updated currency values inside `BudgetCard` must remain fully compatible with existing validation rules and the local saving calls in `db.js`.
- **Zero API and Backend Mutators** — Do not edit `siifService.js` or modify server-side database handlers.

---

## 6. File-by-File Implementation Plan

### `SIIFFormsHub.jsx` (and its twin in standalone application)
- **Current Role**: The parent shell hosting the sequential step wizard [37, L77].
- **Required Changes (Aesthetic Overhaul)**:
  1. **Centered Card Workspace**: Keep the form centered, compact, and optimized for mobile-first scrolling across all devices. Eliminate wide horizontal layouts on desktop:
     ```jsx
     <div className=\"w-full max-w-lg sm:max-w-xl md:max-w-2xl mx-auto px-4 py-4 sm:py-6 pb-28 min-h-screen flex flex-col bg-slate-50/50 dark:bg-slate-950/30\">
     ```
  2. **Solid Unified Header**: Ensure exactly one solid primary header on screen. Replace thin, outlined fonts with bold high-contrast Tailwind styles:
     ```jsx
     <h1 className=\"text-slate-950 dark:text-white font-extrabold text-2xl sm:text-3xl tracking-tight leading-tight text-center sm:text-left\">
       School Innovation & Improvement
     </h1>
     ```
  3. **Floating Sticky Bottom Bar**: Add a persistent floating footer. Maintain matching maximum width boundaries with clean inner shadows and a primary navigation button:
     ```jsx
     <div className=\"fixed bottom-4 left-4 right-4 z-40 max-w-lg sm:max-w-xl md:max-w-2xl mx-auto rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-4\">
       <div className=\"flex items-center justify-between gap-4\">
         <button className=\"w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-base shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] transition-all focus:ring-4 focus:ring-blue-500/30 focus:outline-none\">
           Save & Next →
         </button>
       </div>
     </div>
     ```

### `PriorityImprovementAreaCard.jsx` (and its twin in standalone application)
- **Current Role**: Configures intermediate outcomes and priority areas [37, L124].
- **Required Changes (Aesthetic Overhaul)**:
  1. **Horizontal Outcomes Swipe Carousel (Non-Linear Explorer)**: Replace linear outcome lists at the top of the category tab with a smooth, swipeable card carousel. Users swipe horizontally to browse outcomes:
     ```jsx
     <div className=\"flex gap-3.5 overflow-x-auto pb-4 pt-1 px-1 snap-x scrollbar-none cursor-grab active:cursor-grabbing\">
       {/* Outcome Carousel Card */}
       <button className=\"flex-shrink-0 w-44 snap-start p-4 rounded-2xl border text-left bg-gradient-to-br from-blue-50 to-white dark:from-slate-900 dark:to-slate-800/50 border-blue-200 dark:border-blue-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500\">
         <span className=\"block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1\">IO1</span>
         <p className=\"text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2\">Access to Education</p>
       </button>
     </div>
     ```
  2. **Color-Coded Card Accent Ribbons (Tactile Depth)**: Based on the category or intermediate outcome, assign distinct border accents and subtle background glows. This breaks monotony:
     ```jsx
     // Dynamic accent classes generator
     const getCategoryStyles = (category) => {
       if (category === "ACCESS") return "border-l-4 border-l-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/5 hover:border-emerald-400";
       if (category === "QUALITY") return "border-l-4 border-l-blue-500 bg-blue-50/10 dark:bg-blue-950/5 hover:border-blue-400";
       return "border-l-4 border-l-amber-500 bg-amber-50/10 dark:bg-amber-950/5 hover:border-amber-400";
     };
     ```
  3. **Visual Reorder tactile 3D effect**: When an item is dragged or focused, apply physical elevation (using deep shadow shifts, a scale transform, and a tiny rotation offset):
     ```jsx
     <div
       draggable
       className=\"flex items-center gap-3 p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl cursor-grab active:cursor-grabbing hover:shadow-md hover:scale-[1.01] active:scale-[1.02] active:rotate-1 active:shadow-xl focus-within:ring-2 focus-within:ring-blue-500 transition-all duration-150 outline-none select-none\"
       style={{ touchAction: "none" }} // Fixes mobile drag conflict
     >
       {/* 3D shadow reordering item body */}
     </div>
     ```

### `InterventionsCard.jsx` (and its twin in standalone application)
- **Current Role**: Offers checkboxes for selecting school interventions [37, L9].
- **Required Changes (Aesthetic Overhaul)**:
  1. **Selection Pods (Anti-Boring Checkbox Lists)**: Replace traditional standard browser check rows with physical "Pods." These are larger, grid-friendly cards that light up when checked:
     ```jsx
     <label className={`group relative flex items-start gap-4 p-4 border rounded-2xl cursor-pointer select-none transition-all duration-200 min-h-[52px] ${
       checked 
         ? "border-blue-600 dark:border-blue-500 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/10 dark:to-slate-900 shadow-[0_4px_20px_rgba(59,130,246,0.08)] scale-[1.01]" 
         : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
     }`}>
       <div className=\"flex-1\">
         <span className=\"text-base font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors\">
           {intervention.title}
         </span>
       </div>
       {/* Custom Aesthetic Selection Badge */}
       <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
         checked 
           ? "bg-blue-600 border-blue-600 text-white scale-110 shadow-sm" 
           : "border-slate-300 dark:border-slate-700 group-hover:border-slate-400"
       }`}>
         {checked && <svg className=\"w-3.5 h-3.5 font-bold\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth=\"3\" d=\"M5 13l4 4L19 7\" /></svg>}
       </div>
     </label>
     ```

### `BeneficiariesCard.jsx` (and its twin in standalone application)
- **Current Role**: Displays targeted grades and learner configurations [34, L9].
- **Required Changes (Aesthetic Overhaul)**:
  1. **Symmetric Double-Column Grid Cards**: Group grade levels inside a symmetric 2-column card deck (`grid grid-cols-2 gap-3.5`) instead of flat table stacks. The cards utilize modern vertical typography:
     ```jsx
     <button className={`p-4 rounded-2xl border text-center transition-all ${
       gradeSelected 
         ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10 scale-102 font-bold" 
         : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
     }`}>
       <span className=\"block text-xs uppercase opacity-75 font-semibold tracking-wider\">Grade Level</span>
       <span className=\"text-lg font-extrabold\">Grade 1</span>
     </button>
     ```
  2. **Sliding Vertical Detail Trays**: When a grade block is tapped, animate open a vertically nested tray holding count inputs under the active card:
     ```jsx
     <div className=\"col-span-2 mt-2 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 animate-slide-up space-y-3.5\">
       <div className=\"grid grid-cols-2 gap-3.5\">
         <label className=\"block text-left\">
           <span className=\"block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider\">Learner Count</span>
           <input type=\"number\" className=\"w-full text-center text-lg font-bold p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none\" />
         </label>
         <label className=\"block text-left\">
           <span className=\"block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider\">ARAL Count</span>
           <input type=\"number\" className=\"w-full text-center text-lg font-bold p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none\" />
         </label>
       </div>
     </div>
     ```

### `BudgetCard.jsx` (and its twin in standalone application)
- **Current Role**: Records cost estimates and validates remaining balance limits [37, L11].
- **Required Changes (Aesthetic Overhaul)**:
  1. **Bento-Style Metrics Dashboard (Non-Linear Layout)**: Combine budget totals and balance indicators into a modular, glowing bento layout box rather than simple rows:
     ```jsx
     <div className=\"grid grid-cols-3 gap-3 mb-6\">
       {/* Allocated Tile */}
       <div className=\"col-span-2 p-4 bg-slate-900 text-white rounded-2xl flex flex-col justify-between shadow-md\">
         <span className=\"text-xs font-semibold text-slate-400 uppercase tracking-wider\">Remaining Balance</span>
         <span className=\"text-2xl font-black text-emerald-400 tracking-tight mt-2\">₱45,200.00</span>
       </div>
       {/* Percent Tile */}
       <div className=\"p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-2xl flex flex-col items-center justify-center shadow-sm\">
         <span className=\"text-xs font-bold uppercase tracking-wider\">Utilized</span>
         <span className=\"text-xl font-extrabold mt-1\">78%</span>
       </div>
     </div>
     ```
  2. **Asymmetrical Row cost cells**: Present input elements inside tactile card rows that stack cost parameters in asymmetrical left-aligned boxes with bold typography.

### `ActivitiesCard.jsx` (and its twin in standalone application)
- **Current Role**: Planned operations checklists [36, L12].
- **Required Changes (Aesthetic Overhaul)**:
  1. **Pill-Shaped Activity Badges**: Align selected options with high-visibility, dark blue category tags (`ACCESS AND QUALITY · IO2`) inside compact row layouts to avoid blank gaps.
  2. **Tactile Check Actions**: Row dividers use full card borders with a tactile shadow depth.

---

## 7. UI / UX Behavior
- **Frictionless Screen Boundaries**: Prevent standard vertical clipping. On mobile, scroll bars are hidden while horizontal carousels preserve elastic kinetic scroll actions (`snap-align`).
- **Tactile Touch Guidelines**: Click targets maintain a standard spacing gap with a minimum interactive physical size of `44px` on all phone viewports.
- **Physical Drag Feedback**: While list items are actively moved, standard opacity decreases to 50% and borders transition to dashed rings, providing immediate physical feedback.

---

## 8. Test Plan

### Manual Scenarios
1. **Kinetic Carousel Scroll Test**
   - Setup: Open the Priority Area card sub-segment on a mobile phone simulator.
   - Action: Swipe horizontally across the top intermediate outcome tabs.
   - Expected result: The carousel slides fluidly, snapping to category column cards on release, with no desktop layout breaking.
2. **"Selection Pods" Toggle Test**
   - Setup: Go to the Interventions section.
   - Action: Tap three different options sequentially.
   - Expected result: Row border colors transition smoothly to royal blue, inner backgrounds display soft linear gradients, and selection checkmark circles scale up.
3. **Bento-Grid Space Allocation Check**
   - Setup: Go to the Budget section.
   - Action: Inspect the Remaining Balance block on small vs large viewports.
   - Expected result: The tiles adjust correctly without clipping data.

---

## 9. Acceptance Criteria
- [ ] No boring, uniform linear gray boxes exist in the forms; list containers are refactored into distinct asymmetrical grid arrays or card pods.
- [ ] Intermediate Outcomes are browsable via an elegant, horizontally-swipeable kinetic snap carousel.
- [ ] Checked selections utilize responsive tactile scale updates, border highlights, and custom visual check circles (touch target >= 44px).
- [ ] Complex horizontal grade charts in the Beneficiaries module are replaced with vertical 2-column card decks with slide-down input panels.
- [ ] Estimated costs inside the Budget module are displayed inside an interactive asymmetrical Bento-style metrics block.
- [ ] Drag-and-drop elements on Priority lists implement visible tactile 3D hover/tilt effects, hover gradients, and high-contrast grab anchors.
- [ ] Modifications are symmetrically applied across both standalone instances in `apps/school-head/web/src/modules/siif/` and `apps/siif/web/src/`.

---

## 10. Final AI Coding Prompt
```text
You are a senior UI/UX designer and frontend engineer expert in Tailwind CSS, React, and Mobile-First accessibility.
Your task is to completely overhaul the visual design of the SIIF Hub forms cards (Priority Areas, Interventions, Beneficiaries, Budget, and Activities) under the Forms tab. Move away from flat, boring, linear vertical stacks of uniform grey lists and implement highly engaging, mobile-first card patterns that feel tactile and look premium.

IMPORTANT: Apply changes symmetrically across both twins in the repository:
1) apps/school-head/web/src/modules/siif/
2) apps/siif/web/src/

Strictly preserve all component state management, local hook integrations, array reordering calculations, and IndexedDB saving actions.

Implement the following design overhaul:

1. CENTRALIZED APP SCREEN CODES
Wrap the forms hub view within a single centered layout container `max-w-lg sm:max-w-xl md:max-w-2xl mx-auto px-4 w-full`. All widescreen systems must center this column to preserve identical visual metrics and touchpoints.

2. ONE SOLID CONTRAST HEADER
Remove transparent hollow headings. Consolidate pages so there is exactly ONE primary heading per screen view (e.g. text-slate-950 font-black text-2xl tracking-tight). Replace duplicate headers with clear instruction copy.

3. "NON-LINEAR" OUTCOME SWIPE CAROUSEL (Priority Areas)
Instead of a boring linear vertical list of outcomes at the top, implement a horizontally scrollable snap-carousel. Each outcome card in the carousel must be a compact rectangular block using a subtle gradient fill, bold Outcome labels (e.g., IO1, IO2), and truncated outcome text.

4. SELECTION PODS (Interventions Card)
Overhaul checkboxes. Replace them with beautiful, touch-first card elements ("Selection Pods") that span the full width. When checked, the border must glow/transition into a solid blue border, the card scales up slightly, and the standard browser checkbox is replaced with a custom-built, animated check circle. Use 48px target heights.

5. BENTO METRICS DASHBOARD (Budget Card)
Ditch flat row logs. Setup an asymmetrical Bento-grid header segment containing two columns:
- Grid Left (2/3 width): A high-impact dark slate card showcasing remaining balance with emerald-green currency values.
- Grid Right (1/3 width): An emerald-tinted percentage indicator.
Stack the budget text fields vertically below, ensuring monetary symbols (₱) are cleanly absolute-aligned inside cost inputs. Set inputMode="decimal" and pattern="[0-9]*" for easy keypad triggers.

6. GRADE DECKS WITH NESTED SLIDING TRAYS (Beneficiaries Card)
Replace wide horizontal tables. Build a symmetric 2-column grid representing grades. Tapping a grade card toggles its selected state with custom colors. Upon selection, render a sliding vertical detail tray immediately below the active row containing clean inputs for total and ARAL learners.

7. TACILE 3D REORDERING (Priority Improvement Areas Card)
Prepend a clear visual touch grab handle (⋮⋮). When an item is dragged or focused, apply a tactile scale, light rotation tilt (e.g., rotate-[1deg] scale-[1.02]), and a rich drop-shadow. Active dropzones should show animated dashed border containers. Include standard ArrowUp/ArrowDown onKeyDown listeners.

8. CATEGORY ACCENT RIBBONS
Apply thick, color-coded left-accent borders (`border-l-4`) to cards based on outcome category (e.g., emerald for Access, royal blue for Quality, and amber for Governance) to immediately distinguish listings. Ensure metadata badge text is high contrast (dark text on soft background).

Review all cards before finalizing to ensure visual elements compile flawlessly with Tailwind and present absolute contrast.
```
