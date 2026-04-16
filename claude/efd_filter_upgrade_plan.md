# EFD Filter Upgrade Plan — Multi-Select Dropdowns + Accomplishment Range

## Objective
Replace pill/chip `MultiSelectField` buttons in `FilterDrawer` with proper multi-select dropdowns for Region, Project Category, Funding Year, Batch of Funds. Add Accomplishment Percentage range filter (min–max).

## Files Changed
1. `src/components/FilterDrawer.jsx` — swap MultiSelectField → MultiSelectDropdown, add AccRange section
2. `src/context/EFDFilterContext.jsx` — add `accomplishmentRange` state [0,100]
3. `src/modules/EFDHome.jsx` — wire accRange in handleFilterApply + filteredProjects useMemo
4. `src/modules/EFDMonitoring.jsx` — wire accRange in handleFilterApply + fetchProjectsPaged API params
5. `api/index.js` — add `acc_min`/`acc_max` filter; fix year/batch/category to handle multi-value CSV

## Key Architecture Decisions
- EFDHome filters CLIENT-SIDE (filteredProjects useMemo) → accRange applied in useMemo
- EFDMonitoring filters SERVER-SIDE (fetchProjectsPaged) → accRange sent as acc_min/acc_max params
- Backend year/batch/category currently uses single-value ILIKE → upgrade to ANY(ARRAY[...]) for multi
- AccRange persisted in EFDFilterContext localStorage (key: efd_accomplishmentRange)
