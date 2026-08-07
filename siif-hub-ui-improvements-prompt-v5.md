# Implementation Prompt: SIIF Hub Premium Visual, Tactile & Header Card Design Overhaul (v5)

## 1. Feature Summary
This implementation plan guides a **complete, radical design overhaul** of the entire School Innovation and Improvement Fund (SIIF) Forms Hub UI. This is a pure frontend, UI-only refactoring that preserves all existing state keys, handler functions, and local/IndexedDB synchronization logic. 

The goal of this overhaul is to replace dry, linear, flat grey-box form controls with an **exceptional, premium, and kinetic mobile-first experience** reminiscent of high-end SaaS applications (e.g., Linear, Duolingo, or premium consumer dashboards). 

A key focus of this v5 revision is the **complete redesign and downsizing of the step header cards/banners** at the top of each form tab. These header cards are currently **excessively large and bulky**, eating up critical mobile vertical screen space (viewport real estate) and pushing form fields/inputs below the fold. They must be completely redesigned into ultra-compact, low-profile headers utilizing modern, space-saving typography (such as clean, elegant **Plus Jakarta Sans** or **Inter** fonts) to support immediate visual scanning.

The layout forces a strict centered mobile-column viewport on all displays to maintain identical physical interaction patterns. All list items, checkboxes, grade selection tables, and currency grids are replaced with tactile, interactive, and beautifully animated UI components designed for native fluid touchscreen scanning and single-handed thumb navigation.

---

## 2. Verified Facts
*   **Dual Frontend Locations** — PARITY REQUIREMENT: Refactor both duplicate UI layers symmetrically inside the repository to avoid system divergence:
    *   **Location A (Embedded)**: `apps/school-head/web/src/modules/siif/` — Source: [6, L11]
    *   **Location B (Standalone)**: `apps/siif/web/src/` — Source: [8, L11]
*   **Component Structure** — The exact files in scope of the design overhaul are:
    *   `pages/SIIFFormsHub.jsx` (Main controller wrapper and layout container) — Source: [6, L24; 8, L24]
    *   `pages/cards/PriorityImprovementAreaCard.jsx` (Priority areas card) — Source: [7, L7; 8, L9]
    *   `pages/cards/InterventionsCard.jsx` (Interventions checklist selection card) — Source: [7, L7; 8, L8]
    *   `pages/cards/BeneficiariesCard.jsx` (Grade and targeted learner count card) — Source: [7, L7; 8, L8]
    *   `pages/cards/BudgetCard.jsx` (Form fields for budget estimations) — Source: [7, L7; 8, L8]
    *   `pages/cards/ActivitiesCard.jsx` (Milestone activities configurator) — Source: [7, L7; 8, L8]
*   **Existing Component States & Handlers** — To ensure **no backend or logical breakages**, the redesigned elements MUST bind directly to the existing React state models and triggers:
    *   `draftPIAs` / `saveDraftPIAs()` / `toggleDraftPIA()` — Source: [52, L54; 38, L466]
    *   `toggleGrade()` / `updateCount()` / `updateAralCount()` — Source: [35, L231; 38, L434]
    *   `handleAmountChange()` — Source: [36, L34; 38, L435]
    *   `toggleActivity()` — Source: [35, L24; 38, L412]
*   **Styling System** — Tailwind CSS utilities are primary, with custom configurations in `siif.css`:
    *   `apps/school-head/web/src/modules/siif/styles/siif.css` — Source: [7, L7]
    *   `apps/siif/web/src/styles/siif.css` — Source: [8, L9]

---

## 3. Assumptions and Unknowns

### Likely
*   The original step header cards contain redundant titles and heavy vertical margins/paddings (`py-8` or `py-10`) that make them feel like standalone pages rather than structured workflow components. 
*   Replacing custom heavy stroke-outlined heading typography with solid, high-density, filled modern sans-serif typefaces (e.g., **Plus Jakarta Sans** or **Inter**) will dramatically modernize the aesthetic and visual layout of the hub.
*   The parent components in `SIIFFormsHub.jsx` or the cards use helper titles like `getMainHeaderTitle()` or `getHeaderTitle()`. Overriding these functions to return streamlined text strings (with clean, elegant class configurations) will easily apply the header redesign globally.

### Unknown
*   How the system fonts are bundled. The redesign will explicitly load and bind **Plus Jakarta Sans** and **Inter** fonts via standard Google Fonts directives in the `siif.css` files to ensure browser-wide compatibility.

---

## 4. Affected Surfaces
| Surface | Status | Expected Role | Blueprint Source |
|---|---|---|---|
| `SIIFFormsHub.jsx` (both copies) | Verified | Layout core; restrict desktop content container width; standardize solid premium headers; implement bottom-sheet dialog drawer overlays and floating menu footer. | Route -> Component Map [55] |
| `PriorityImprovementAreaCard.jsx` (both copies) | Verified | Redesign step header card to be compact; layout priority areas into vertical tiles with left border accent bands; add responsive drag-and-drop kinetics. | Route -> Component Map [55] |
| `InterventionsCard.jsx` (both copies) | Verified | Redesign step header card; overhaul list items into glowing, rounded \"Selection Pods\" with custom animated checkboxes and tactile hover scaling. | Route -> Component Map [55] |
| `BeneficiariesCard.jsx` (both copies) | Verified | Redesign step header card; replace all grids and standard input lines with a symmetric 2-column grade card deck and vertical drop-down numeric detail trays. | Route -> Component Map [55] |
| `BudgetCard.jsx` (both copies) | Verified | Redesign step header card; overhaul layout with a premium asymmetrical \"Bento Grid\" metrics header, custom percentage rings, and absolute icon-anchored input fields. | Route -> Component Map [55] |
| `ActivitiesCard.jsx` (both copies) | Verified | Redesign step header card; reshape activities into an interactive \"Timeline Pathway\" with step nodes, connected lines, and clean category-specific tags. | Route -> Component Map [55] |
| `siif.css` (both copies) | Verified | Clean outdated hollow typography styles; load clean **Plus Jakarta Sans** and **Inter** font family declarations; implement glassmorphism effects and custom slide transitions. | Route -> Component Map [56] |

---

## 5. Data Model and Contract Requirements
*   **State Signatures Locked**: Do NOT change the properties, keys, arrays, or API schemas of the components. The underlying state arrays (`draftPIAs`, activity lists, beneficiary counts) must be updated in memory exactly as they were previously, ensuring perfect backward compatibility with `siifService.js` and IndexedDB local caching.
*   **Logical Operations Preserved**: Existing verification alerts, conditional window lock checks (`isCardLocked`), and summary calculation methods must remain fully active behind the gorgeous new presentation layer.

---

## 6. File-by-File Implementation Plan

### `siif.css` (Twin locations)
- **Overhaul Directive**: Import modern clean fonts and clean up heavy, bulky outline typography classes.
- **Specific Styling Redesign**:
  1. **Clean Typography Imports**: Inject Google Fonts import declarations at the top of the stylesheet:
     ```css
     @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800;900&display=swap');
     ```
  2. **Font Classes**: Define custom global typography utility overrides:
     ```css
     .siif-font-header {
       font-family: 'Plus Jakarta Sans', 'Inter', sans-serif !important;
     }
     .siif-font-body {
       font-family: 'Inter', sans-serif !important;
     }
     ```
  3. **Abolish Outlines**: Delete all text-stroke and hollow-text outline CSS utilities (`-webkit-text-stroke`, `text-shadow` overlays) that cause visual clutter.

---

### `SIIFFormsHub.jsx` (Twin locations)
- **Overhaul Directive**: Introduce a premium, centered, glassmorphic column shell with an immersive, space-saving progress tracker.
- **Specific Visual Overhaul**:
  1. **Strict Mobile-Viewport Focus**: Regardless of display size, restrict content scaling to a narrow, centered layout (`max-w-md sm:max-w-lg mx-auto`). This isolates the reading zone to a centered column, making widescreen look like an elegant, focused floating control board with a subtle card backdrop (`bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-2xl`).
  2. **Solid Premium Page Header**: Drop all duplicate hollow typography. Keep exactly one primary heading:
     ```jsx
     <h1 className="siif-font-header text-xl md:text-2xl font-black text-slate-950 dark:text-white tracking-tight leading-none mb-1 text-center">
       SIIF Implementation Plan
     </h1>
     ```
  3. **Visual Floating Bottom Sheets**: Details dialog modals must slide up from the viewport bottom like native mobile drawers:
     ```jsx
     <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center animate-fade-in p-0">
       <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[85vh] animate-slide-up border border-t border-slate-200/80 dark:border-slate-800">
         {/* Details and Guideline info inside Sheet */}
       </div>
     </div>
     ```
  4. **Integrated Sticky Stepper Footer**: Stick the primary navigation controls to the screen base inside a physical, blur-translucent bar:
     ```jsx
     <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/60 p-4 shadow-lg">
       <div className="max-w-md sm:max-w-lg mx-auto flex items-center justify-between gap-4">
         <button className="flex-1 min-h-[48px] px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-2xl shadow-md transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500/30">
           Save & Next →
         </button>
       </div>
     </div>
     ```

---

### Step Header Card Redesign (Applied uniformly to ALL cards/sub-forms)
*Components: `PriorityImprovementAreaCard.jsx`, `InterventionsCard.jsx`, `BeneficiariesCard.jsx`, `BudgetCard.jsx`, `ActivitiesCard.jsx`*

- **The Problem**: Currently, each sub-form displays a massive, space-wasting header card or colored banner at the top (`py-8` to `py-12`, with huge text classes and large margins). This is completely unsuitable for mobile screens as it pushes vital input elements below the fold.
- **The Redesign Requirement**:
  1. **Shrink & Condense**: Completely dismantle the old bulky banner container blocks. Replace them with a **sleek, low-profile header row** with minimal vertical padding (`py-2.5 px-3` or `py-3 px-4`). 
  2. **Font & Size Transformation**: Style the titles strictly with the new `.siif-font-header` class. Heading sizes must be tightly capped:
     - Main Tab Title: Scale down from massive sizes to a crisp `text-base` or `text-lg` (max `text-xl` on desktops).
     - Eyebrow Category Text: Style at `text-2xs` or `text-xs` with heavy, tracking-wide formatting (`font-black tracking-widest text-slate-400`).
  3. **Category Tag Integration**: Instead of taking up separate row cards, embed a small, crisp micro-badge or a clean left colored border alongside the title to serve as an instant, space-saving visual anchor:
     ```jsx
     {/* Redesigned Compact Header Block Example */}
     <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 py-2">
       <div className="flex flex-col">
         <span className="text-2xs font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-0.5">
           {getEyebrowText()}
         </span>
         <h2 className="siif-font-header text-base md:text-lg font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-tight">
           {getHeaderTitle() || "Select or Review Improvement Areas"}
         </h2>
       </div>
       <span className="px-2 py-1 text-2xs font-extrabold text-blue-900 bg-blue-50 dark:text-blue-200 dark:bg-blue-950 rounded-md">
         {getCardStatusBadge()}
       </span>
     </div>
     ```

---

### `PriorityImprovementAreaCard.jsx`
- **Overhaul Directive**: Implement the new compact header and transform listed priority areas into modern tiles with left-aligned category indicators.
- **Specific Visual Overhaul**:
  1. **Compact Step Header**: Implement the compact, space-saving header card structure detailed above, reducing vertical footprint by 70%.
  2. **Dynamic Tactical Cards**: Transform listed priority areas into modern tiles containing thick, color-coded left-aligned category indicators (`border-l-4`):
     - *ACCESS AND QUALITY*: Deep Emerald Left Border (`border-emerald-500`) with matching soft background (`bg-emerald-50/40 dark:bg-emerald-950/20`).
     - *GOVERNANCE*: Warm Amber Left Border (`border-amber-500`) with matching background (`bg-amber-50/40 dark:bg-amber-950/20`).
  3. **Tactile Grab Reordering Handles**: Prepend double-column drag icons (`⋮⋮`) styled to glow on card hover. Render subtle dashed placeholder shadows (`border-dashed border-2 border-blue-400 bg-blue-50/20`) when cards are actively dragged or selected.
  4. **Accessibility Typography Fix**: Increase card text size to `16px` (`text-base font-semibold text-slate-800 dark:text-slate-100 mb-1`) and tighten outer layouts (`p-3`) to maximize content scanning on smaller touchscreens.

---

### `InterventionsCard.jsx`
- **Overhaul Directive**: Apply the new compact header and overhaul list items into glowing, rounded \"Selection Pods\".
- **Specific Visual Overhaul**:
  1. **Compact Step Header**: Apply the space-saving typography header redesign to clear vertical real estate for touch scanning.
  2. **Interactive Selection Pods**: Wrap each intervention inside a high-density, rounded card block acting as a massive click target (`min-h-[56px]`):
     ```jsx
     <label className={`flex items-start gap-4 p-4 border rounded-2xl cursor-pointer select-none transition-all duration-300 ${
       isSelected 
         ? 'bg-blue-50/30 dark:bg-blue-950/20 border-blue-500 dark:border-blue-400 shadow-md scale-[1.01]' \
         : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
     }`}>
     ```
  3. **Animated Success Checkmarks**: Instead of a flat checkbox, hide the native input, and show a custom animated success SVG circle that transitions from soft grey to deep blue with a checkmark on selection.
  4. **Content Dense Spacing**: Apply a structured visual grid with `space-y-3` vertical margins to keep selections tightly packed.

---

### `BeneficiariesCard.jsx`
- **Overhaul Directive**: Apply the new compact header and replace standard grid rows with a 2-column Grade Grid Deck with expandable sliding panels.
- **Specific Visual Overhaul**:
  1. **Compact Step Header**: Swap bulky banners with a low-profile title row styled with the `.siif-font-header` font classes.
  2. **2-Column Grade Grid Deck**: Grade configurations must be presented as a clean grid of high-contrast square touch blocks:
     ```jsx
     <div className="grid grid-cols-2 gap-3 mb-4">
       {/* Grade Selection cards */}
     </div>
     ```
  3. **Expandable Vertical Detail Trays**: Tapping a grade card expands an underlying nested tray containing focused numeric inputs for the specific grade.
  4. **Touch-Optimized Digit Steppers**: Replace plain numeric text fields with compact steppers (+ and - buttons flanking a centered count) to easily increment values with a single tap without invoking the soft keyboard.

---

### `BudgetCard.jsx`
- **Overhaul Directive**: Overhaul the flat cost overview with a high-density \"Bento Box\" analytical workspace layout.
- **Specific Visual Overhaul**:
  1. **Compact Step Header**: Implement the compact, space-saving typography header block, allowing the dashboard bento grids to stay fully visible.
  2. **Bento Metrics Dashboard**: Replace text lists at the top of the budget cards with an asymmetrical layout of beautiful metrics tiles:
     - *Primary Tile*: Extra-large dark block (`bg-slate-900 dark:bg-slate-950 p-4 rounded-3xl col-span-2 flex justify-between items-center`) reflecting Remaining Funds with an emerald numerical value.
     - *Secondary Tile*: Circular budget utilization percentage indicator (`col-span-1`) featuring a clean SVG progress radial gauge.
  3. **Premium Currency Fields**: Format cash inputs with integrated, high-contrast currency tags anchored securely inside the text fields, utilizing standard `inputMode="decimal"` values to automatically load standard decimal keypads.

---

### `ActivitiesCard.jsx`
- **Overhaul Directive**: Apply the new compact header and refactor the checklist into a chronological \"Timeline Milestone Pathway\".
- **Specific Visual Overhaul**:
  1. **Compact Step Header**: Shrink the header banner to a compact header row styled with the `.siif-font-header` class.
  2. **Chronological Milestone Nodes**: Style activities as successive timeline items along a continuous vertical indicator track line.
  3. **Bold Metadata Tags**: Darken the metadata labels (like `ACCESS AND QUALITY · IO2`) using high-contrast dark pills.

---

## 7. UI / UX Behavior
*   **Widescreen Parity Scaling**: The design restricts stretching on desktops using centered parent blocks. This ensures a uniform reading layout and thumb reach, keeping mouse interactions identical to smartphone finger gestures.
*   **Touch Element Dimensions**: Every selectable card row, reorder handle, trigger button, and counter component uses a physical click margin of at least `44px` to pass strict mobile touch criteria.
*   **Tactile Transitions**: Transitions use smooth CSS transformations (`transition-all duration-300 ease-out`) with responsive active triggers (`active:scale-98`) to immediately confirm user touch inputs.

---

## 8. Test Plan

### Manual Scenarios
1. **Bulky Header Compression Test**
   - Setup: Open any of the form step tabs (e.g. Budget Estimations) on a mobile device view.
   - Action: Check what is visible on the screen before scrolling.
   - Expected result: The step header is compact and neat (under `60px` tall). The primary form elements (such as the Bento dashboard or grade grids) are fully visible above the fold without requiring a scroll down.
2. **Font Families and Outlines Audit**
   - Setup: Open the SIIF Hub page and inspect titles, subheadings, and metadata.
   - Action: Examine font weights and check for text stroke outlines.
   - Expected result: All outlined headers are replaced with solid, high-contrast filled titles. The font loaded for headers matches **Plus Jakarta Sans** and body texts use **Inter**, with crisp reading lines.
3. **Kinetic Reordering Check**
   - Setup: Open the `PriorityImprovementAreaCard` containing multiple items.
   - Action: Drag an item from index 0 to index 2 using the handle. Focus a row and use keyboard `ArrowUp` or `ArrowDown` keys.
   - Expected result: Row list changes sequence smoothly, and the active-drag style matches transparent dashed blocks while maintaining proper order state.

---

## 9. Acceptance Criteria
- [ ] ALL bulky step header cards or banner boxes at the top of sub-forms are completely eliminated and replaced with streamlined, low-profile headers (`py-2.5 px-3` or `py-3 px-4`).
- [ ] No hollow or outlined fonts exist on any headings. Titles are strictly filled, high-contrast bold weights.
- [ ] All headers in the SIIF Hub utilize the **Plus Jakarta Sans** or **Inter** sans-serif font families for premium visual rendering.
- [ ] Main heading heights do not exceed `60px` to `80px` on mobile viewports, allowing form fields to sit above the fold.
- [ ] Forms maintain a strict, centralized mobile-column boundary structure (`max-w-md mx-auto`) on both desktop and handheld screens.
- [ ] Duplicated page headings are removed; instruction labels like \"Select or Review Improvement Areas\" provide clean direction.
- [ ] Priority area lists use vertical tiles with colored category bands, physical reordering drag-handles, and active grab states.
- [ ] Checkbox grids inside Interventions are completely replaced with animated, full-width Selection Pod cards.
- [ ] Horizontal table structures inside BeneficiariesCard are eliminated in favor of a 2-column Grade Grid Deck with drop-down accordion inputs.
- [ ] BudgetCard implements an asymmetrical Bento Metrics dashboard header complete with custom utilization gauges.
- [ ] Symmetrical modifications are applied flawlessly inside `apps/school-head/web/src/modules/siif/` and `apps/siif/web/src/` with no logical mutations to parent states.

---

## 10. Final AI Coding Prompt
```text
You are a senior frontend architect specializing in premium Mobile-First Product Design, Tailwind CSS, and Web Accessibility (WCAG). 
Your task is to execute a complete visual, interactive, and tactile design overhaul of the entire SIIF forms hub interface. 

IMPORTANT: Apply these refactors symmetrically inside the repository:
1) apps/school-head/web/src/modules/siif/
2) apps/siif/web/src/

This is a PURE frontend visual overhaul. Maintain all existing state parameters (like draftPIAs, activity arrays, amounts), handler function signatures, and IndexedDB save operations. Do NOT introduce any database or backend changes.

Refactor the following list of files:
- pages/SIIFFormsHub.jsx (Forms core layout wrapper)
- pages/cards/PriorityImprovementAreaCard.jsx
- pages/cards/InterventionsCard.jsx
- pages/cards/BeneficiariesCard.jsx
- pages/cards/BudgetCard.jsx
- pages/cards/ActivitiesCard.jsx
- styles/siif.css

Enforce these strict, premium product-level design constraints:

1. STRICT CENTERED COLUMN VIEWPORT
Wrap the main layout in SIIFFormsHub inside a restricted centered container (`max-w-md sm:max-w-lg mx-auto w-full px-4`). On widescreen/desktop views, the app must float centered in the exact same width and layout density as a modern smartphone screen, utilizing a clean card surface layout with subtle backdrop blur gradients (`backdrop-blur-md bg-white/80 dark:bg-slate-900/80`).

2. ULTRA-COMPACT LOW-PROFILE HEADER CARDS
Dismantle all massive, space-wasting step header cards and colored banner boxes at the top of sub-form components (which currently eat up vertical viewport space). Replace them with an ultra-compact, low-profile header row (max height 60px-80px, py-2.5 px-3). This is a critical requirement to keep primary form inputs visible above the fold on mobile screens.

3. MODERN SANS-SERIF TYPOGRAPHY OVERHAUL
Completely overhaul typography. Standardize all forms to use premium modern sans-serif fonts: 'Plus Jakarta Sans' for headings and 'Inter' for body texts (imported cleanly in siif.css). Completely eliminate hollow/outlined typography styled via text-stroke. Use filled bold high-contrast text styles Cap tab headings to a neat text-base or text-lg tracking-tight weight.

4. COPY CLEANUP & DUPLICATE HEADER MERGING
Remove duplicated titles: render exactly ONE primary heading per view. Convert duplicates into instructional labels (such as "Select or Review Improvement Areas") styled as small, clean subtexts.

5. FLOATING BOTTOM STEPS NAV DRAWER
Implement a beautiful, sticky viewport footer (`fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/60 p-4`) containing the primary action button ("Save & Next →"). The buttons must fit cleanly inside the boundaries of the centered layout shell, utilizing a generous touch target height of at least 48px.

6. PREMIUM MODAL BOTTOM-SHEETS
For description overlays or option guides, completely avoid standard inline redirects. Render interactive slide-up bottom-sheets (`fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl bg-white dark:bg-slate-950 z-50 animate-slide-up border-t border-slate-200`) on mobile screens, converting into centered dialog frames on widescreen desktop viewports.

7. CARD ACCENTS & DRAG GRABS (PriorityImprovementAreaCard)
Transform dry listed rows into tactile priority cards. Each card must feature a distinct category left border band (border-l-4): ACCESS AND QUALITY (emerald-500) or GOVERNANCE (amber-500). Prepend vertical drag handles (⋮⋮) to each item row. Build reactive HTML5 drag-and-drop mechanics in React memory while keeping fully accessible keyboard bindings (ArrowUp/ArrowDown) active. Ensure metadata tags are dark high-contrast pills (text-emerald-950 bg-emerald-100 font-extrabold text-xs).

8. INTERVENTIONS: TACTILE SELECTION PODS (InterventionsCard)
Abolish default HTML checklists. Overhaul items into glowing, rounded selection cards (pods). Tapping anywhere on the pod card selects it, triggering a border color transition (border-blue-500), a subtle scale expansion (scale-[1.01]), and an inner micro-gradient layout shift. Replace native checkboxes with custom animated SVG circle ticks.

9. BENEFICIARIES: GRADE grids & STEP TRAYS (BeneficiariesCard)
Do NOT use horizontal tables. Replace them with a 2-column Grade Grid Deck of touchable square blocks. Tapping a grade card shifts its highlight and expands an underlying details drawer ("drop tray") below it. Inside the drawer, implement compact +/- touch counter steppers flanking a bold count value so the user can edit values with quick taps instead of soft text keyboards.

10. BUDGET: ASYMMETRICAL BENTO PANELS (BudgetCard)
Convert estimated cost forms into a Bento Grid Dashboard. Place a primary slate tile displaying Remaining Funds in high-contrast emerald values, and a secondary tile housing an SVG budget utilization circular progress dial. Configure money input fields with permanent currency symbol markers (₱) and numeric key-flags (inputMode="decimal") to automatically pop up phone dialpads.

11. ACTIVITIES: CHRONOLOGICAL timeline pathways (ActivitiesCard)
Overhaul lists of configured activities into successive timeline items anchored along a central vertical line trail. Tapping the activities lights up their sequence nodes chronologically, giving users a satisfying sense of milestone completion.

Preserve 100% of existing React state hooks, handlers, and IndexedDB operations. Ensure the code compiles flawlessly.
```
