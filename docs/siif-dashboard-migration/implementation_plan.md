# SIIF: Move Each Dashboard Into Its Own Page

**Branch:** `feature/siif-optional-forms`
**Team lead's ask:** *"Within the Utilization tab, add tabs to separate the dashboard from the data collection. Migrate your Utilization dashboard here. Do the same for SIIF plans."*
**Status:** Built 2026-10-12. Decisions: old Dashboard page removed · opening SIIF lands on **Forms › Dashboard** · KPI cards dropped · Dashboard shows saved figures + amber note · tab names as proposed.

---

## In one picture

**Today:** the sidebar's **Dashboard** page holds *both* dashboards behind a switch.
```
Sidebar            Main panel
───────            ──────────────────────────────────────────────
Dashboard   ──►    [ SIIF Plan | Utilization ]   ← both dashboards live here
Forms       ──►    Plan form (data collection only)
Utilization ──►    [ Overview | Record Spending | History ]
Settings
```

**After:** each dashboard moves next to the form it belongs to.
```
Sidebar            Main panel
───────            ──────────────────────────────────────────────
Forms       ──►    [ Dashboard | Plan Form ]                     ← SIIF Plan dashboard moves here
Utilization ──►    [ Dashboard | Record Spending | History ]     ← Utilization dashboard moves here
Settings
(Dashboard page removed; old links redirect, see question 1)
```

Rule of thumb: **sidebar = which module**, **in-page tabs = look at it (Dashboard) or fill it in (data collection)**. That's the Malaysian EdTech layout from the last task, now on both pages.

---

## Part A: Utilization page

| Tab | Contents |
|---|---|
| **Dashboard** (was "Overview") | **Top row:** donut (30%) + spending-per-quarter chart (70%), both from the last task.<br>**Below (migrated from the old Dashboard page):** the quarter filter (All / Jul–Sep / Oct–Dec / Jan–Mar), **Spending by Intervention**, and **Quarterly Disbursement by Intervention** (chart + table). |
| **Record Spending** | Unchanged |
| **History** | Unchanged |

**The old dashboard's 4 KPI cards** (Allocation, Utilized, Remaining, Rate) say the same thing as the donut. I'll **drop them** so the numbers don't appear twice (question 3).

**Which numbers does the Dashboard show?** The old Dashboard page only showed **saved** data. Inside the Utilization page, unsaved edits are also in memory. I recommend:
- The Dashboard tab shows **saved figures**, the same ones the division sees.
- With unsaved edits, a small amber note says *"Showing saved figures. You have unsaved changes in Record Spending."*

The hook already keeps the saved copy (`savedSnapshot`), so this costs nothing extra.

**Files**
| File | Change |
|---|---|
| `pages/SIIFUtilization.jsx` | Rename tab `overview` → `dashboard`. Render `UtilizationOverview`'s sections under the charts. Reuse `buildDashboard()` with the saved snapshot. Old `?tab=overview` links still work. |
| `components/dashboard/UtilizationOverview.jsx` | Add an option to hide the KPI row. Its "Go to Utilization" button becomes a "Record Spending" tab switch. |

---

## Part B: Forms (SIIF Plan) page

| Tab | Contents |
|---|---|
| **Dashboard** | The current **SIIF Plan** dashboard (`PlanOverview`): plan status, allocation, priority areas, interventions, budget summary |
| **Plan Form** | Today's form wizard, unchanged |

**Behaviour**
- The tab is kept in the URL (`#/siif/forms?tab=dashboard`), like the Utilization page.
- The Dashboard's "Open the plan form" buttons (they navigate to `/siif/forms` today) **switch to the Plan Form tab** instead.
- **"Not yet open" lock screen:** today it replaces the whole Forms page. With tabs, the **Dashboard tab still works** and only the **Plan Form** tab shows the lock message. Its "Return to Dashboard" button switches tabs instead of leaving the page.
- The Forms page's existing save/draft behaviour isn't touched. Tabs live in the same page, so form state survives switching.

**Files**
| File | Change |
|---|---|
| `pages/SIIFFormsHub.jsx` (1,446 lines) | Add `PageTabs` under the header. Wrap the wizard as the "Plan Form" panel. Move the lock screen inside that panel. |
| `components/dashboard/PlanOverview.jsx` | `navigate('/siif/forms')` (3 places) → an `onOpenForm()` prop |
| `hooks/useSIIFPlan.js` | Used for the Dashboard tab's data, the same as the old Dashboard page |

`PageTabs.jsx` (built last task) is reused as is, so both pages look and behave the same.

---

## Part C: The old Dashboard page

Once both views have moved, the sidebar's **Dashboard** page would be empty.

| Option | What happens |
|---|---|
| **A. Remove it** ⭐ recommended | Remove the sidebar item. `/siif/dashboard` redirects to the right new place (`?view=utilization` → Utilization › Dashboard, otherwise → Forms › Dashboard). Login lands on **Utilization › Dashboard**, since utilization is required and the plan is optional. |
| B. Keep a slim summary | Keep the sidebar item with just a few headline numbers from both modules and links to each page. Users see the same numbers in 2 places. |

**Links to update for option A:** the BottomNav item, `SIIFModule.jsx` routes (index + `*` fallback), and the Forms lock screen's "Return to Dashboard". Also check any school-head shell links into `/siif/dashboard` (I'll search for them).

---

## Order of work
1. **Utilization:** rename the tab and migrate the dashboard sections (Part A)
2. **Forms:** tabs + Plan dashboard + lock screen moved into the Plan Form tab (Part B)
3. **Remove the old Dashboard page** and add the redirects (Part C)
4. Lint, build, update docs

## Risks & safeguards
| Risk | Safeguard |
|---|---|
| Old bookmarks to `/siif/dashboard` break | Redirect route that keeps `?view=` meaning |
| Forms page is large (1,446 lines) | Only wrap its existing return in a tab panel. No logic changes to saving or validation. |
| The two hooks fetch the same data twice on Forms | `useSIIFPlan` (dashboard) and `useSIIFSubmission` (form) each already load on their own. Acceptable for now; can be merged later. |
| Dashboard shows numbers that differ from Record Spending | The "Showing saved figures" note explains it |
| No database or API changes | ✅ Frontend only |

## Testing checklist
- [ ] Utilization › Dashboard: donut + bar chart + intervention charts; the quarter filter changes the lower charts
- [ ] Unsaved edit → Dashboard shows the amber "saved figures" note
- [ ] Forms › Dashboard shows the plan status; "Open the plan form" switches tabs
- [ ] Forms when not yet open: Dashboard works, Plan Form shows the lock message
- [ ] `/siif/dashboard` and `/siif/dashboard?view=utilization` redirect correctly; login lands on Utilization › Dashboard
- [ ] Refresh keeps the tab on both pages; dark mode; phone width
- [ ] Lint + build

---

## ❓ Open questions
1. **Old Dashboard page:** remove it (**A**, recommended) or keep a slim summary (**B**)?
2. **After login, land on:** Utilization › Dashboard (recommended) or Forms › Dashboard?
3. **Drop the 4 KPI cards** that repeat the donut's numbers? (Recommended: yes)
4. **Dashboard numbers:** saved figures + amber note (recommended), or include unsaved edits live?
5. **Tab names:** Utilization = "Dashboard · Record Spending · History", Forms = "Dashboard · Plan Form". OK?
