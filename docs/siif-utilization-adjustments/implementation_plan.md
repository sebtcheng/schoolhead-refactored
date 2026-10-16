# SIIF Utilization: Team Lead Adjustments

**Branch:** `feature/siif-optional-forms`
**Scope:** School Head (SH) app, SIIF Utilization page, plus one small SIIF API change.
**Status:** Plan, waiting for answers to the open questions (bottom of this file).

---

## At a glance

| # | Adjustment | Where | Size | Backend change? |
|---|---|---|---|---|
| 1 | Remove the Install App popup | `Login.jsx` | XS | No |
| 2 | SweetAlert warning on unsaved changes | `SIIFModule.jsx`, `BottomNav.jsx`, new hook | M | No |
| 3 | Amount field read-only + **"+"** button opens "Add spending" modal (amount + date) | `InterventionCard.jsx`, new modal, `SIIFUtilization.jsx`, API helper | L | **Yes** |
| 4 | "Save changes" button on the card, kept in sync with the floating save bar | `InterventionCard.jsx`, `SaveBar.jsx`, `SIIFUtilization.jsx` | M | No |
| 5 | Block values that start with 0 (e.g. `0020`) | `utilizationUi.js` | XS | Optional |

Suggested order: **5 → 1 → 4 → 3 → 2**. Items 5 and 1 are quick. Item 4 adds the "what changed?" tracking that items 2 and 3 use.

---

## 1. Remove the Install App popup

**Today:** [Login.jsx:207-211](../../apps/school-head/web/src/Login.jsx#L207-L211) opens the "How to Install" modal on every page load when the app is not installed (`setShowInstallModal(true)`).

**Change:**
- Delete the auto-open block (`if (!isStandalone) setShowInstallModal(true);`).
- **Option A (recommended):** keep the small `INSTALL APP` button at [Login.jsx:699](../../apps/school-head/web/src/Login.jsx#L699), so users who want the app can still open the instructions themselves.
- **Option B:** remove the button, the modal (line ~1108) and the `beforeinstallprompt` logic too.

**Test:** Open the login page in a normal browser tab. No popup should appear.

---

## 2. SweetAlert warning on unsaved changes

### What we can and can't control

| User action | Can we show a SweetAlert? | What we'll do |
|---|---|---|
| Click another SIIF tab (Dashboard / Forms / Settings) in the BottomNav | ✅ Yes | SweetAlert: "Leave without saving?" with the buttons **Save & leave**, **Leave**, **Stay** |
| Browser Back / Forward button | ✅ Yes (with a workaround) | Catch the hash change, go back to the page, then show the same SweetAlert |
| Refresh (F5), close the browser tab, type a new URL | ⚠️ **Browser's own dialog only** | Browsers don't allow custom popups here. The current `beforeunload` handler stays, and the browser shows its standard "Leave site?" dialog |
| Switch quarter tabs (Jul–Sep → Oct–Dec) | No prompt needed | Edits are kept in memory across quarters, so nothing is lost |

> **Note for the team lead:** a SweetAlert **cannot** appear on refresh or tab close. Browsers block custom dialogs there to stop scam pages from trapping users. The browser's built-in dialog is the only option, and it's already in place ([SIIFUtilization.jsx:68-77](../../apps/siif/web/src/pages/SIIFUtilization.jsx#L68-L77)).

### Why we need a custom guard
The app uses `HashRouter` ([App.jsx:1](../../apps/school-head/web/src/App.jsx#L1)). React Router's `useBlocker` only works with data routers (`createBrowserRouter`), so we can't use it. Switching routers is out of scope because it would touch every module.

### Implementation
1. **Install** `sweetalert2` in the workspace that bundles the SH app (`apps/school-head/web`). It's not installed anywhere yet.
2. **New file** `apps/siif/web/src/context/UnsavedChangesContext.jsx`
   - Stores `isDirty` and an optional `onSaveRequest()` (registered by the Utilization page).
   - Exposes `confirmLeave(): Promise<boolean>`, which shows the SweetAlert when dirty and resolves immediately when clean.
   - Listens to `hashchange`. If the user presses Back while dirty, it restores the previous hash, then calls `confirmLeave()`.
3. **New file** `apps/siif/web/src/components/utilization/confirmUnsaved.js`: one place for the Swal config (InsightEd colours `#08315F` / indigo, rounded corners, dark-mode aware), so every prompt looks the same.
4. **`SIIFModule.jsx`**: wrap the routes in `<UnsavedChangesProvider>`.
5. **`BottomNav.jsx`**: the 4 `navigate(item.path)` calls (lines 64, 83, 128, 142) become `confirmLeave().then(ok => ok && navigate(item.path))`.
6. **`SIIFUtilization.jsx`**: report `isDirty` and `handleSave` to the context. Keep the existing `beforeunload` effect.

**Edge cases:**
- "Save & leave" runs the normal save. If the save fails (over allocation, missing activities), we **stay** on the page and show the error toast.
- While `saving` is true, the guard waits. It doesn't navigate halfway through a save.
- Logout and links outside SIIF (school-head shell): wrap them only if they're reachable from the SIIF layout. To check during implementation.

---

## 3. Read-only amount + "+" button → "Add spending" modal

### What changes for the user
- The **Utilized Amount** field can no longer be typed in. It shows the quarter's **total of all spending entries**.
- A **"+"** button inside the field (right side, as in the screenshot) opens a modal:
  - **Amount spent** (₱, with the same validation as item 5, must be more than 0)
  - **Date spent** (date picker, defaults to today, limited to the quarter's months; see the open questions)
  - Shows "Up to ₱X available" and blocks amounts over the remaining allocation (same rule as today)
  - Buttons: **Add** / **Cancel**
- Below the field, a short list of entries for that quarter, e.g. `Jul 14 · ₱2,000.00`, so users can see where the total comes from (with ✕ to remove, if approved).
- Locked quarter: the "+" button is hidden and the entries are view-only.

### Data shape (inside the existing JSONB, no new table, no DDL)
Each quarter gains an `expenses` array. `amount` stays and is **always the sum** of the entries, so the dashboard, `spent_amount` sync, audit and monitoring code keep working unchanged.

```js
// selected_interventions[i].quarters['July-September']
{
  amount: '5000',                       // = sum(expenses), kept for every existing reader
  justification: '...',
  activities: [...],
  other_activity: '',
  expenses: [                           // NEW
    { id: 'e_1728712345', amount: '3000', date: '2026-07-14' },
    { id: 'e_1728712399', amount: '2000', date: '2026-08-02' },
  ],
}
```

**Old records** (an amount but no `expenses`) are shown as one entry, "Previously recorded · ₱5,000.00", with no date. Nothing is rewritten until the user saves.

### Files
| File | Change |
|---|---|
| `components/utilization/AddExpenseModal.jsx` (new) | The modal, rendered with `createPortal` so it isn't clipped by the card's `overflow-hidden`. Framer Motion entry, focus trap, Esc closes it |
| `components/utilization/InterventionCard.jsx` | Input gets `readOnly`, a "+" button and the entries list. `handleAmount` typing is removed |
| `components/utilization/utilizationUi.js` | `expensesOf(q)` and `sumExpenses(list)` helpers. `amountOf` is unchanged |
| `pages/SIIFUtilization.jsx` | `handleAddExpense(intId, {amount, date})` and `handleRemoveExpense(intId, expenseId)`. Both reuse the allocation-cap check from `handleUpdateUtilization` and set `amount = sum`. `persistUtilization` sends `expenses` |
| **`api/helpers/utilizationPeriods.js`** | ⚠️ `sanitizeQuarter()` currently **drops unknown fields**, so without this change `expenses` would be silently lost on save. Add `sanitizeExpenses()`: max 100 entries, amount > 0, ISO date, and **the server recomputes `amount` from `expenses`** so the client can't send a mismatched total |
| `api/routes/modifiedUtilization.js` | No logic change. `spentOf()` keeps reading `amount` |

---

## 4. "Save changes" on the card, synced with the floating save bar

### Problem today
`hasUnsavedChanges` is a single `true/false` flag that is only set by input handlers. It doesn't know **which** card changed, and it stays `true` even when the user undoes their edit.

### Fix: compare against a saved snapshot
1. In `SIIFUtilization.jsx`, keep `savedSnapshot` (a ref holding the data as last loaded or saved). It's set after a load and after each successful save.
2. Compute it instead of storing a flag:
   - `dirtyCards = selectedInterventions.filter(id => !isEqual(utilizationData[id], savedSnapshot[id]))`, plus any added or removed intervention.
   - `hasUnsavedChanges = dirtyCards.length > 0`.
   - Remove all the `setHasUnsavedChanges(true)` calls.
3. **`InterventionCard`** gets an `isDirty` prop. When it's true, a small amber **"Save changes"** pill appears in the header, in the spot boxed in red in screenshot 2 (left of ✕), with a soft fade/scale-in.
4. **Connected to the floating bar:** the card button and the `SaveBar` button both call the **same `handleSave`** and share the same `saving` state:
   - Click either one: both show the spinner.
   - Save succeeds: the card pill disappears **and** the bar turns to "All changes saved".
   - The bar subtitle names the cards: *"2 interventions changed: Remediation, Enhancement"*.

> The API saves the whole utilization record in one transaction, so "Save changes" on a card saves **all** pending edits. Saving one card alone would need a new partial-update endpoint. Not recommended.

---

## 5. Block values starting with 0

**Today:** [`sanitizeAmountInput`](../../apps/siif/web/src/components/utilization/utilizationUi.js#L34-L38) allows `0020`.

**Rule:**
| Typed | Becomes |
|---|---|
| `0020` | `20` |
| `00` | `0` |
| `0.50` | `0.50` (allowed: a zero before the decimal point) |
| `.5` | `0.5` |
| `05.25` | `5.25` |

```js
export const sanitizeAmountInput = (text) => {
    const cleaned = String(text).replace(/[^0-9.]/g, '');
    let [whole, ...rest] = cleaned.split('.');
    whole = whole.replace(/^0+(?=\d)/, '');           // strip leading zeros, keep a single 0
    if (rest.length && whole === '') whole = '0';      // ".5" → "0.5"
    return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};
```
This is used in the item 3 modal. Optionally, the server's `sanitizeExpenses` also normalizes with `String(parseFloat(x))`.

---

## Risks & safeguards

| Risk | Safeguard |
|---|---|
| `expenses` silently dropped by the server | Update `sanitizeQuarter` in the same PR, and test a save → reload round-trip |
| Old rows break the new UI | `expensesOf()` falls back to one "Previously recorded" entry |
| Client total ≠ entries | Server recomputes `amount` from `expenses` |
| Modal clipped or under the save bar | `createPortal` to `document.body`, z-index above `.siif-save-bar` (z-40) |
| DB safety | No DDL, no DELETE. Only the JSONB content written by the existing UPSERT changes. Deletion lock untouched |

## Testing checklist
- [ ] Login: no install popup on load
- [ ] Type `0020` → shows `20`. `0.5` is still allowed
- [ ] "+" → add ₱3,000 (Jul 14) + ₱2,000 (Aug 2) → field shows ₱5,000.00 → Save → reload → both entries are still there
- [ ] Amount over the remaining allocation is blocked in the modal
- [ ] Locked quarter: no "+" button, entries view-only
- [ ] Edit a card → card pill + amber bar appear → undo the edit → both disappear
- [ ] Click the card's "Save changes" → bar and pill update together
- [ ] Dirty + BottomNav → SweetAlert. Stay / Leave / Save & leave all behave correctly
- [ ] Dirty + browser Back → SweetAlert
- [ ] Dirty + F5 → browser's native dialog
- [ ] Dark mode: modal, pill and SweetAlert all readable
- [ ] `npm run lint` and `npm run build` pass

---

## ❓ Open questions (need answers before coding)
1. **Install popup:** remove only the auto-popup (keep the small INSTALL APP button), or remove everything?
2. **Spending entries:** can users **delete** an entry they added by mistake? (Recommended: yes, only before the quarter is locked.) Can they **edit** one, or only delete and re-add?
3. **Date limit:** must the date fall within the quarter being recorded (e.g. Jul–Sep only)? Can it be a future date?
4. **Old amounts:** is showing them as "Previously recorded" (no date) okay, or should users be forced to re-enter them with dates?
5. **"Another tab":** did the team lead mean the SIIF nav tabs (Dashboard/Forms/Settings)? Or also leaving SIIF for other SH modules?
