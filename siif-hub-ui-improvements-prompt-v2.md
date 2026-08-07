# Implementation Prompt: SIIF Hub Unified Mobile-First UI & Accessibility Overhaul (v2)

## 1. Feature Summary
This implementation plan guides a comprehensive frontend visual, structural, and accessibility overhaul of the entire School Innovation and Improvement Fund (SIIF) Forms Hub. It extends the improvements uniformly across all form segments under the Forms tab: Priority Improvement Areas, Interventions, Beneficiaries, Budget, and Activities. 

The refactoring follows a strict **mobile-first architectural model**, optimizing all interfaces for single-handed thumb operation on mobile viewports. On widescreen/desktop screens, the UI maintains identical visual structure, scrolling paradigms, and touch-target locations by scaling inside a centered responsive column wrapper (`max-w-lg sm:max-w-xl md:max-w-2xl mx-auto`), avoiding side-by-side desktop layout shifts. Outlined headings are replaced with filled high-contrast text, navigation friction is eliminated by displaying detail guides inside bottom-sheet style modals, interactive hover/drag states are refined, and a unified touch-accessible reordering pattern is applied.

---

## 2. Verified Facts
- **SIIF Dual App Locations** — Symmetrical modifications are required across both standalone frontend instances in the repository to guarantee parity:
  - Location A: `apps/school-head/web/src/modules/siif/` — Source: [6, L11]
  - Location B: `apps/siif/web/src/` — Source: [8, L11]
- **Forms Hub Pages & Sub-Cards** — The main controller and individual step sub-cards inside both locations include:
  - `pages/SIIFFormsHub.jsx` (Main controller) — Source: [6, L24; 8, L24]
  - `pages/cards/PriorityImprovementAreaCard.jsx` (Priority areas card) — Source: [7, L7; 8, L9]
  - `pages/cards/InterventionsCard.jsx` (Interventions selection card) — Source: [7, L7; 8, L8]
  - `pages/cards/BeneficiariesCard.jsx` (Beneficiary grade/count card) — Source: [7, L7; 8, L8]
  - `pages/cards/BudgetCard.jsx` (Budget estimates card) — Source: [7, L7; 8, L8]
  - `pages/cards/ActivitiesCard.jsx` (Activities configuration card) — Source: [7, L7; 8, L8]
- **SIIF Shared Stylesheets** — Shared CSS for styling overrides:
  - `apps/school-head/web/src/modules/siif/styles/siif.css` — Source: [7, L7]
  - `apps/siif/web/src/styles/siif.css` — Source: [8, L9]
- **Pure Frontend Boundary** — Reordering, step tracking, and drafts are saved inside local component states (`draftPIAs`, `screen`, `activeModalInt`) and saved locally before hitting submission, allowing safe, zero-api refactoring. — Source: [51, L44; 52, L44]

---

## 3. Assumptions and Unknowns

### Likely
- Outlined headers are rendered using transparent fills with text-shadow or `-webkit-text-stroke` styling in `siif.css`. These will be overridden with filled Tailwind classes (e.g., `text-slate-950 font-bold`).
- Double-titles occur when both the main card container `SIIFFormsHub.jsx` and the individual active card components redundantly render the form title at the top of their containers. 
- Mobile forms are highly prone to horizontal overflow due to nested layouts or wide tables (such as grade counts). Swapping these for vertical stacks will eliminate horizontal viewport scroll.

### Unknown
- The user's screen heights on small touch devices vary. To prevent critical content clipping, the bottom footer action bar should be sticky on scroll, and card dialog overlays will allow standard vertical scroll overflows.

---

## 4. Affected Surfaces
| Surface | Status | Expected Role | Blueprint Source |
|---|---|---|---|
| `SIIFFormsHub.jsx` (both instances) | Verified | Center overall workspace; standardize main page header; establish centered narrow grid limits; add sticky bottom action navbar. | Route -> Component Map [54] |
| `PriorityImprovementAreaCard.jsx` (both instances) | Verified | Replace outlined banner text; increase list size to 16px; apply native mobile-first touch/grab reordering handles with Arrow key support. | Route -> Component Map [54] |
| `InterventionsCard.jsx` (both instances) | Verified | Solidify selection headers; adjust item padding; add checkbox touch zones (minimum `48px` tap targets); optimize category contrast. | Route -> Component Map [54] |
| `BeneficiariesCard.jsx` (both instances) | Verified | Convert complex multi-column horizontal grade tables into stacked mobile-first card rows with large touch inputs. | Route -> Component Map [54] |
| `BudgetCard.jsx` (both instances) | Verified | Tighten budget row spacing; replace multi-column field blocks with vertical currency inputs (with explicit `inputMode="decimal"`). | Route -> Component Map [54] |
| `ActivitiesCard.jsx` (both instances) | Verified | Replace outlined headers; convert inline tagging options to full-width row panels with darker accessible text colors. | Route -> Component Map [54] |
| `siif.css` (both instances) | Verified | Clean custom outline utilities; define visual focus and active-drag styling classes. | Route -> Component Map [55] |

---

## 5. Data Model and Contract Requirements
- **JSON Payload Format Preserved** — Ensure that local state modifications (such as sorting `draftPIAs` or changing amounts in `BudgetCard`) do not mutate the baseline object schemas required by local database operations in `db.js`. 
- **Pure Frontend Execution** — All interactivity (sorting lists, opening modal details, calculating total plan values) happens entirely inside client React structures, keeping the backend contract completely untouched.

---

## 6. File-by-File Implementation Plan

### `SIIFFormsHub.jsx` (and its dual in `apps/siif/web/src/pages/SIIFFormsHub.jsx`)
- **Current Role**: Wraps all step forms inside a sequence container [37, L77].
- **Mobile-First Layout Constraint**:
  1. **Centered Mobile Column Viewport**: Wrap the main visual card viewport inside a narrow layout wrapper. On desktop, this wrapper prevents horizontal stretching and mirrors the exact width and reading rhythm of a phone:
     ```jsx
     <div className="w-full max-w-lg sm:max-w-xl md:max-w-2xl mx-auto px-4 py-4 md:py-6 pb-28">
     ```
  2. **Page Header Duplication Fix**: Consolidate header wrappers. Keep exactly **one** primary heading inside `SIIFFormsHub.jsx` using filled, dark typography (`text-slate-950 dark:text-white font-extrabold text-2xl`). Completely strip any page titles rendered inside child card components.
  3. **Universal Bottom-Sheet Modals**: For displaying details of categories or reference lists, replace navigation links with fixed overlay modals. Style them like an elegant mobile bottom-sheet that slides up or centers cleanly:
     ```jsx
     <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
       <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[85vh] animate-slide-up">
         {/* Modal Content */}
       </div>
     </div>
     ```
  4. **Sticky Mobile Action Footer**: Replace absolute footers with a sticky navigation bar fixed to the viewport bottom. Frame it with the same maximum width boundaries to align cleanly with the content card on wide screens:
     ```jsx
     <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 shadow-lg">
       <div className="max-w-lg sm:max-w-xl md:max-w-2xl mx-auto flex items-center justify-between gap-4">
         {/* Navigation details */}
         <button className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-base shadow-md active:scale-95 transition-all focus:ring-4 focus:ring-blue-500 focus:outline-none">
           Save & Next →
         </button>
       </div>
     </div>
     ```

### `PriorityImprovementAreaCard.jsx` (and its dual in `apps/siif/web/src/pages/cards/PriorityImprovementAreaCard.jsx`)
- **Current Role**: Manages the priority area selection list [35, L124].
- **Required Changes**:
  1. **Solid Banner Headers**: Find the rendering code for headers (`getMainHeaderTitle` or `getHeaderTitle`). Change transparent text outlines to solid, deep colors: `text-slate-900 dark:text-white font-bold text-xl md:text-2xl`.
  2. **Action-Oriented Instruction**: Replace duplicate category or priority labels with instructional text: `"Select or Review Improvement Areas"`.
  3. **Increased List Item Text**: Scale main priority items list text to `16px` (Tailwind `text-base`), with condensed paddings (`p-3`) to maximize vertical real estate.
  4. **High-Contrast Metadata Badges**: Change tag colors (e.g., `ACCESS AND QUALITY · IO2`) to solid dark colors:
     ```jsx
     <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold tracking-wider text-blue-950 bg-blue-100 rounded-md select-none">
       ACCESS AND QUALITY • IO2
     </span>
     ```
  5. **Touch-First Native HTML5 Drag and Drop**: Prepend a clear touch-friendly double vertical dot drag handle (`⋮⋮`) styled to resize rows on grab. Bind standard drag/drop touch events alongside robust keyboard listeners:
     ```jsx
     <div
       draggable
       onDragStart={(e) => handleDragStart(e, index)}
       onDragOver={(e) => e.preventDefault()}
       onDrop={(e) => handleDrop(e, index)}
       className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500 outline-none transition-all cursor-grab active:cursor-grabbing"
       tabIndex="0"
       onKeyDown={(e) => handleKeyboardReorder(e, index)}
     >
       <div className="text-slate-400 font-bold select-none cursor-row-resize py-2 px-1 min-h-[44px] flex items-center justify-center">
         ⋮⋮
       </div>
       <div className="flex-1 text-base font-medium text-slate-800 dark:text-slate-100">
         {item.title}
       </div>
     </div>
     ```

### `InterventionsCard.jsx` (and its dual in `apps/siif/web/src/pages/cards/InterventionsCard.jsx`)
- **Current Role**: Renders checkboxes for selecting interventions [35, L9].
- **Required Changes**:
  1. **Solid Solidified Headers**: Convert any thin hollow text layouts to high-density solid black/white bold faces.
  2. **Expanded Touch Selection Rows**: Standardize checkboxes to occupy full row widths. Use interactive list item container tags (tap target `min-h-[48px]`) so tapping anywhere on the card row toggles the selection:
     ```jsx
     <label className="flex items-start gap-3.5 p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all select-none">
       <input 
         type="checkbox" 
         className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 mt-0.5 focus:ring-offset-0 focus:outline-none focus:ring-2"
       />
       <span className="text-base text-slate-800 dark:text-slate-200 font-medium leading-normal">
         {intervention.title}
       </span>
     </label>
     ```
  3. **Tightened Spacings**: Set content gap structures strictly to `space-y-2.5` to prevent scroll fatigue on long forms.

### `BeneficiariesCard.jsx` (and its dual in `apps/siif/web/src/pages/cards/BeneficiariesCard.jsx`)
- **Current Role**: Displays targeted grades and learner configurations [34, L9].
- **Required Changes**:
  1. **Anti-Horizontal Table Wrapping**: Horizontal tables cause massive layout breaks on small device viewports. Completely replace horizontal tabular grade reports with **vertical card rows**.
  2. **Mobile-First Grade Detail Cards**:
     - Grade level selections should be presented as prominent vertical row blocks.
     - When selected, a clean inner nested layout opens vertically, stacking the count fields cleanly:
       ```jsx
       <div className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
         <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Grade 1 Target Metrics</span>
         <div className="grid grid-cols-2 gap-3">
           <label className="block">
             <span className="block text-xs font-semibold text-slate-500 mb-1">Total Learners</span>
             <input 
               type="number" 
               inputMode="numeric"
               pattern="[0-9]*"
               className="w-full text-base p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
             />
           </label>
           <label className="block">
             <span className="block text-xs font-semibold text-slate-500 mb-1">ARAL Learners</span>
             <input 
               type="number" 
               inputMode="numeric"
               pattern="[0-9]*"
               className="w-full text-base p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
             />
           </label>
         </div>
       </div>
       ```

### `BudgetCard.jsx` (and its dual in `apps/siif/web/src/pages/cards/BudgetCard.jsx`)
- **Current Role**: Form layout managing estimated budget entries [35, L11].
- **Required Changes**:
  1. **Mobile-First Numeric Keypads**: For all currency inputs, ensure the touch display triggers the phone's native numeric decimal keyboard by setting `inputMode="decimal"` and `pattern="[0-9]*"`.
  2. **Stacked Input Form Rows**: Align currency estimation rows vertically. Ensure currency prefix indicators (`₱`) are embedded directly inside high-contrast text fields for clear reading:
     ```jsx
     <div className="relative rounded-xl shadow-sm">
       <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
         <span className="text-slate-500 text-base font-bold">₱</span>
       </div>
       <input
         type="text"
         inputMode="decimal"
         className="block w-full pl-8 pr-4 py-3 text-base font-semibold border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
         placeholder="0.00"
       />
     </div>
     ```
  3. **Remaining Balance High Contrast Tag**: Replace any faint yellow or light green balance markers. Style the balance with high-visibility WCAG-compliant tags:
     ```jsx
     <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between">
       <span className="text-sm font-semibold opacity-90">Remaining Balance:</span>
       <span className="text-base font-bold text-emerald-400">₱45,200.00</span>
     </div>
     ```

### `ActivitiesCard.jsx` (and its dual in `apps/siif/web/src/pages/cards/ActivitiesCard.jsx`)
- **Current Role**: Renders list checklist of planned activity metrics [34, L12].
- **Required Changes**:
  1. **Banner Solidification**: Ensure the primary activity guide banner header is solid and high contrast (`text-slate-900 dark:text-white`).
  2. **Condense List Row Layouts**: Display action research items as compact, tap-friendly row selections with unified padding (`p-3`).
  3. **High-Contrast Activity Category Badges**: Colorize tags with legible dark blue context tags (`ACCESS AND QUALITY`) instead of low-contrast pastel tags.

---

## 7. UI / UX Behavior
- **Unified Screen Layout**: On widescreen, the content scales up to `672px` (`max-w-2xl`) and centers, giving a completely identical thumb-reorder experience as a mobile viewport. 
- **Tap Target Accessibility (WCAG)**: Interactive triggers (buttons, list item rows, close buttons) adhere to a minimum tap dimension of `44px` on mobile, preventing overlap misclicks.
- **Save State Flow**: Clicking the persistent floating bottom bar trigger saves the layout details inside local IndexedDB instances, transitioning step screens with sliding animations without rendering blank transition pages.

---

## 8. Test Plan

### Manual Scenarios
1. **Responsive Widescreen Container Scaling Test**
   - Setup: Open the SIIF Forms Hub on a desktop monitor.
   - Action: Drag the browser width from full widescreen down to a narrow mobile width (`375px`).
   - Expected result: The content remains locked in a centered mobile column view, presenting identical visual elements, text scales, and spacings without breakages.
2. **Horizontal Table Overflow Regression Audit**
   - Setup: Open the `BeneficiariesCard` form segment on mobile.
   - Action: Attempt to swipe sideways across the cards.
   - Expected result: No horizontal scrolling occurs. Grid count boxes stack vertically inside touchcards, ensuring a fluid vertical scroll.
3. **Budget Thumb Input Keypad Test**
   - Setup: Focus a currency estimation element on an iOS or Android device.
   - Action: Inspect the keyboard interface.
   - Expected result: The device opens a clean numerical/decimal dialpad instead of a standard alphabetic layout.

---

## 9. Acceptance Criteria
- [ ] Visual page layout maintains a centralized mobile wrapper on both phone and wide display screens using `max-w-lg sm:max-w-xl md:max-w-2xl mx-auto px-4`.
- [ ] No horizontal scrolling or vertical layout breaks exist on any of the sub-form pages (Interventions, Beneficiaries, Budget, Activities, Priority Areas).
- [ ] Main banner titles are rendered as solid filled fonts passing WCAG accessibility contrast limits (no hollow outlines).
- [ ] The forms hub displays exactly one primary header per screen view; secondary duplicate headings are replaced with action-oriented instruction labels.
- [ ] Touch target bounds on interactive cards, handles, and inputs are kept at a tap target minimum of `44px` (with `p-3.5` padding margins).
- [ ] List items inside Priority Areas use a touch-accessible native HTML5 reordering interface with standard arrow-key keyboard backups.
- [ ] Detail informational sections render within sliding overlay modals inside the page viewport, eliminating inline sub-page redirections.
- [ ] Parity adjustments are synchronized symmetrically under both `apps/school-head/web/src/modules/siif/` and `apps/siif/web/src/`.

---

## 10. Final AI Coding Prompt
```text
You are an expert React and Tailwind CSS developer with deep specialized skills in Mobile-First UI/UX and Web Accessibility (WCAG). 
Your task is to refactor the entire SIIF forms hub interface to follow a strict "mobile-first" layout structure, ensuring that forms look and feel like focused mobile apps on both handheld viewports and widescreen displays.

IMPORTANT: Apply changes symmetrically across both twins in the repository:
1) apps/school-head/web/src/modules/siif/
2) apps/siif/web/src/

This is a pure frontend, UI-only refactoring. Do NOT introduce any database, api, or server alterations.

Refactor the following components:
- pages/SIIFFormsHub.jsx (Main viewport)
- pages/cards/PriorityImprovementAreaCard.jsx
- pages/cards/InterventionsCard.jsx
- pages/cards/BeneficiariesCard.jsx
- pages/cards/BudgetCard.jsx
- pages/cards/ActivitiesCard.jsx
- styles/siif.css

Enforce these strict mobile-first design system rules:

1. CENTERED COLUMN WORKSPACE
Wrap the forms hub view within a single centered column `max-w-lg sm:max-w-xl md:max-w-2xl mx-auto px-4 w-full`. Widescreen devices must render the exact same narrow card interface to preserve layout scanning and reading patterns.

2. STICKY ACTION NAV BAR
Implement a persistent sticky navigation footer locked at the bottom of the screen (`fixed bottom-0 left-0 right-0`). The footer controls must align within the content column bounds (`max-w-lg sm:max-w-xl md:max-w-2xl mx-auto`). Provide a prominent "Save & Next →" primary action button with a touch target size of 48px.

3. ACCESSIBLE CONTRAST & TYPOGRAPHY
Replace all transparent or outline typography on headers with solid filled, high-contrast text styles (e.g., text-slate-950 dark:text-white font-extrabold text-2xl). Consolidate headings so there is exactly ONE main page header per view, converting duplicates into instruction labels (such as "Select or Review Improvement Areas"). Use metadata badges with high-contrast text colors (e.g., dark blue on light blue). Set item descriptions to 16px (text-base) for optimal legibility.

4. DETAIL SCREEN BOTTOM SHEETS
Show option details or guidelines using absolute modal overlays (`backdrop-blur-sm bg-black/60`). On mobile, render these as a bottom-sheet (sliding up from screen bottom); on desktop, center the modal dialog nicely. Completely eliminate external sub-page navigations.

5. ACCESSIBLE INPUTS & GAPS
Tighten padding inside card containers to `p-3` or `p-3.5` to avoid dead spaces. Touch targets for checkboxes, input fields, and drag handles must keep a minimum size of 44px. Use `space-y-2.5` vertical item spacing.

6. BUDGET INPUT OPTIMIZATION
Configure all currency numeric inputs inside BudgetCard with inputMode="decimal" and pattern="[0-9]*" to force mobile numeric keypads. Place currency symbol prefixes inside inputs. Render balance statuses in a highly legible dark solid pill container.

7. CARD-BASED GENDERS & GRADES (ANTI-TABLE)
Ensure BeneficiariesCard has NO horizontal table structures. Replace horizontal tables with vertical cards that stack content. Display grade selections as big touchable blocks that toggle a clean vertical sub-panel containing stacked count text fields.

8. NATIVE TOUCH REORDERING
For PriorityImprovementAreaCard, implement standard HTML5 touch reordering lists using a drag handle icon (⋮⋮). Combine drag/drop hooks (onDragStart, onDragOver, onDrop) with reactive array mutations inside parent state bindings. Ensure full accessibility by implementing onKeyDown listeners supporting ArrowUp/ArrowDown reordering.

Ensure the refactored forms look solid, compile perfectly with Tailwind, and do not introduce any visual breakages.
```
