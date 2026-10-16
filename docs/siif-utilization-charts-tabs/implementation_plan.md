# SIIF Utilization: Charts + In-Page Tabs

**Branch:** `feature/siif-optional-forms`
**Builds on:** [siif-utilization-adjustments](../siif-utilization-adjustments/implementation_plan.md) (the "+" spending entries)
**Status:** Built 2026-10-12. Decisions: Utilized vs Remaining · toggle for both chart orders · 3 bars · tabs on Utilization only · default tab names.

---

## At a glance

| # | Request | What we build | Size | Backend? |
|---|---|---|---|---|
| 1 | Pie chart instead of the 3 stat cards (30% width) | **Donut chart**: Utilized vs Remaining, with the % in the middle | S | No |
| 2 | Pareto bar chart per quarter, tracking spending over time (70% width) | **Bars** = total per quarter, **line** = running total over time | M | **Yes, small:** record *when* each entry was added |
| 3 | Tabs in the main panel, like the Malaysian EdTech apps | **Tabs under the header**, in the red box: Overview · Record Spending · History | M | No (the History endpoint already exists) |

Both charts use **Recharts**. It's already installed and used by [QuarterlyDisbursementChart.jsx](../../apps/siif/web/src/components/dashboard/QuarterlyDisbursementChart.jsx), so they'll match that look (same colours, same dark mode via `useIsDark`).

---

## What the page will look like

```
┌───────────────────────────────────────────────────────────────┐
│  School Innovation and Improvement Fund            [FY 2026]  │  ← header (unchanged)
├───────────────────────────────────────────────────────────────┤
│  [ Overview ]  [ Record Spending ]  [ History ]               │  ← NEW in-page tabs (item 3)
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  OVERVIEW TAB                                                 │
│  ┌──── 30% ──────┐ ┌──────────────── 70% ──────────────────┐  │
│  │   ╭───────╮   │ │ ₱   ▇▇▇                    ── 100%    │  │
│  │  ╱ 24.5%  ╲  │ │     ▇▇▇   ▇▇▇         ●──── 75%     │  │
│  │  ╲utilized╱  │ │     ▇▇▇   ▇▇▇   ●──              50%     │  │
│  │   ╰───────╯   │ │     ▇▇▇ ● ▇▇▇                    25%     │  │
│  │ ● Used ₱13.5k │ │    Jul–Sep Oct–Dec Jan–Mar              │  │
│  │ ● Left ₱41.5k │ │  bars = per quarter, line = running total │  │
│  │ Alloc ₱55k    │ │                                          │  │
│  └───────────────┘ └──────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
   On phones the two charts stack (pie on top, bar chart below).
```

- **Record Spending tab:** what's on the page today (quarter tabs, intervention selector, intervention cards, "+" button, Save bar).
- **History tab:** a timeline of every spending entry and save, newest first.

---

## 1. Donut chart (30% width)

**Replaces** the 3 cards (Official Allocation / Total Utilized / Remaining Balance). Their numbers move into the donut's legend, so nothing is lost.

| Part | Shows |
|---|---|
| Slice 1 (blue) | **Utilized** ₱13,500.00 |
| Slice 2 (green) | **Remaining** ₱41,500.00 |
| Centre label | **24.5%** utilized |
| Legend below | Allocation, Utilized and Remaining, with peso amounts |
| Over budget | The donut turns red and the centre reads "Over by ₱X" |
| No allocation yet | Grey ring with "No allocation yet" (same message as today) |

**File:** new `components/utilization/UtilizationDonut.jsx` (Recharts `PieChart` + `Pie` with `innerRadius`).

> **Why a donut instead of a full pie?** It's still a pie chart, but the hole in the middle holds the big "24.5%" number. A pie with only 2 slices reads better this way.

---

## 2. Bar chart per quarter + running total (70% width)

**Replaces** the "FY 2026 Utilization Progress" bar.

| Part | Shows |
|---|---|
| **Bars** (left axis, ₱) | Total spent in each quarter: Jul–Sep ₱8,500 · Oct–Dec ₱5,000 · Jan–Mar ₱0 |
| **Line** (right axis, %) | **Running total** as % of the allocation, so you can watch the money get used over time |
| Dashed reference line | 100% = the full allocation |
| Tooltip on a bar | Quarter total + its entries (date · intervention · amount) |
| Locked / not-started quarter | Faded bar with a 🔒 label |

**File:** new `components/utilization/QuarterParetoChart.jsx` (Recharts `ComposedChart`: `Bar` + `Line`, the same building blocks as the dashboard chart).

### About "Pareto" (one decision needed, see question 2)
A **true Pareto chart** sorts the bars **from biggest to smallest**, not by date. Its line shows the running % of the total, which answers "which quarter used most of the money?".
Your team lead also said **"tracking of expenditure across time"**, which needs the bars **in calendar order** (Jul → Oct → Jan).

| Option | Bars sorted by | Line shows | Good for |
|---|---|---|---|
| **A. Time-ordered Pareto** ⭐ recommended | Quarter order (Jul → Jan) | Running total % of **allocation** | Seeing the money get used over time |
| B. Classic Pareto | Biggest → smallest | Running % of **total spent**, with an 80% line | Seeing which quarter used the most |

Option A is in the mockup above. I can also add a small toggle to switch between A and B (+ ~30 min).

### Backend: record *when* an entry was added
Each spending entry already has a **`date`** (the day the money was spent, picked in the modal). Your team lead also wants the day it was **added**, so we add **`recorded_at`**:

```js
expenses: [
  { id: 'e_…', amount: '3000', date: '2026-07-14', recorded_at: '2026-10-12T03:15:22.000Z' }  // NEW field
]
```

| Rule | Why |
|---|---|
| The **server** sets `recorded_at` the first time it sees an entry, and keeps the stored value after that | A user can't fake or backdate it |
| Editing an entry keeps its original `recorded_at` and adds `updated_at` | The history shows "added Oct 12 · edited Oct 14" |
| Old / "Previously recorded" entries have no `recorded_at` | They show as "Recorded before tracking" |

**Files:** `api/helpers/utilizationPeriods.js` (`sanitizeExpenses` keeps both timestamps) and `api/routes/modifiedUtilization.js` (stamps new entries using the stored row it already locks with `FOR UPDATE`). The data stays inside the same JSONB column: **no new table, no schema change, no DELETE.**

---

## 3. In-page tabs (the Malaysian EdTech style)

The **sidebar** stays as it is: Dashboard / Forms / Utilization / Settings. **Inside** the Utilization page, a second row of tabs sits right under the header (in the red box):

| Tab | Contents |
|---|---|
| **Overview** | Donut (30%) + bar chart (70%) |
| **Record Spending** | Today's page: quarter tabs, intervention selector, intervention cards, "+" button |
| **History** | Timeline of every spending entry and save, from the existing `GET /modified-utilization/:schoolId/history` endpoint (service already in `siifService.js`) |

**How it behaves**
- The selected tab is saved in the URL (`#/siif/utilization?tab=history`), so a refresh keeps you on the same tab. Tab switches *replace* the history entry, so Back still leaves the page instead of stepping through tabs.
- Switching tabs **doesn't lose unsaved edits**. All tabs live in the same page, so no SweetAlert is needed between them. The Save bar stays visible on every tab while there are unsaved changes.
- Animated underline (Framer Motion `layoutId`), keyboard arrows (←/→), and `role="tablist"` for screen readers.
- On phones the tabs scroll sideways if they don't fit.

**Files:** new `components/utilization/PageTabs.jsx`, `UtilizationDonut.jsx`, `QuarterParetoChart.jsx`, `UtilizationHistory.jsx`. The Record panel stays inline in `SIIFUtilization.jsx`: it uses ~25 page values and handlers, so moving it would add risk for little gain. `UtilizationSummary.jsx` was removed (replaced by the two charts).

---

## Suggested order
1. **Tabs first** (item 3). The charts and the cards then each get their own tab.
2. **Donut** (item 1). Quick, frontend only.
3. **`recorded_at`** on the backend, then the **bar chart** (item 2).
4. **History** tab (it uses `recorded_at` too).

## Risks & safeguards
| Risk | Safeguard |
|---|---|
| A user changes `recorded_at` in the request | The server ignores the sent value and only keeps its own stamp |
| Charts are slow on low-end phones | Only 3 bars + 2 slices. Recharts animations are short and respect "reduce motion" |
| Dark mode unreadable | Reuse the dashboard chart's `THEME` colours + `useIsDark` |
| Old entries break the chart | `expensesOf()` already turns old amounts into one "Previously recorded" entry |

## Testing checklist
- [ ] Overview: donut %, amounts and the 30/70 split match; it stacks on a phone
- [ ] Over budget: the donut turns red
- [ ] Bar chart: quarter totals match the Record tab; the running-total line ends at the overall %
- [ ] Add an entry with "+" → Save → History shows "added <today>"; editing it keeps the original time
- [ ] Tabs: refresh keeps the tab; Back works; unsaved edits survive tab switches
- [ ] Dark mode on all 3 tabs
- [ ] `pnpm --filter @apps/school-head-web build` passes

---

## ❓ Open questions
1. **Pie contents:** Utilized vs Remaining (recommended)? Or split by **intervention** (Remediation, Enhancement, Prevention…)?
2. **Bar chart order:** Option **A** (time order + running total, recommended), **B** (classic biggest-first Pareto), or a toggle with both?
3. **Bars per quarter or per month?** "Across time" could also mean 9 monthly bars (Jul … Mar) grouped by quarter. Per quarter is simpler and matches your team lead's wording.
4. **Tabs:** only on the Utilization page for now? Or also on the Dashboard and Forms pages?
5. **Tab names:** "Overview · Record Spending · History" okay, or would your team lead prefer other names?
