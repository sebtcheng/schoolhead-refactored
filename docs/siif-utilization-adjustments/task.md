# Task Ledger: SIIF Utilization Adjustments

See [implementation_plan.md](implementation_plan.md).

## 0. Decisions (confirmed 2026-10-12)
- [x] Install popup: remove only the automatic popup, keep the INSTALL APP button
- [x] Spending entries can be edited and deleted (open quarters only)
- [x] Dates must fall inside the quarter, no future dates
- [x] Old amounts show as "Previously recorded" (current data is test data)
- [x] Unsaved-changes guard covers SIIF navigation only

## 5. Leading-zero validation
- [x] `sanitizeAmountInput`: `0020 → 20`, `.5 → 0.5`, `0.50` allowed (verified)

## 1. Remove the Install App popup
- [x] Auto-open removed in `Login.jsx`; manual button kept

## 4. Card "Save changes" + synced save bar
- [x] `savedSnapshot` / `markSaved` in `useModifiedSIIFUtilization`
- [x] Derived `dirtyIds` / `hasUnsavedChanges` (undoing an edit clears it)
- [x] "Save changes" pill in the `InterventionCard` header, shared `handleSave` / `saving`
- [x] `SaveBar` subtitle lists the changed interventions

## 3. Read-only amount + "+" spending modal
- [x] `expensesOf` / `sumExpenses` / `quarterDateRange` helpers (verified)
- [x] `ExpenseModal.jsx`: portal, amount + date, add / edit / delete, cap check
- [x] `InterventionCard`: read-only amount, "+" button, entries list
- [x] Payload sends `expenses`
- [x] API: `sanitizeExpenses`, `amount` recomputed, `invalidExpenseReason` (verified)

## 2. SweetAlert unsaved-changes guard
- [x] `sweetalert2` added to `@apps/siif-web`
- [x] `confirmUnsaved.js` (themed, dark-mode aware)
- [x] `UnsavedChangesContext.jsx` + `unsavedChanges.js` (BottomNav, Nexus, Sign Out, Back/Forward)
- [x] Utilization page registers `isDirty` + `handleSave`

## Verify
- [x] Lint clean on all new/changed files (pre-existing errors elsewhere untouched)
- [x] `pnpm --filter @apps/school-head-web build` passes
- [ ] Manual browser test (checklist in the plan)
