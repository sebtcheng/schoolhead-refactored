---
description: Fast-track search for a JSX file based on a natural language description.
---

# Find JSX by Description (Streamlined)

This workflow is optimized for speed. Follow these steps to locate the file in the minimum number of turns.

## Phase 1: High-Speed Search
Immediately execute a multi-pattern `grep_search` using the most unique terms from the user's description.

1. **Aggressive Grep**
   Target `src` and `Includes: ["*.jsx"]`.
   Search for UI text, component names, or unique feature keywords simultaneously if possible, or run a single broad search on the most specific term.

   ```json
   {
     "Query": "UniqueTerm",
     "SearchPath": "src",
     "Includes": ["*.jsx"],
     "MatchPerLine": true
   }
   ```

2. **Instant Directory Pivot**
   - **Form/Step/Unit**: Go directly to `src/components/modular/`.
   - **Page/Route**: Look at `src/App.jsx` or `src/Login.jsx` first.
   - **UI Element**: Check `src/components/`.

## Phase 2: Rapid Verification & Return
Verify the most likely candidate immediately.

3. **Snap-View**
   Use `view_file` on the top candidate. If you see the keyword and the structure matches the description (e.g., "submit button", "has a map"), **stop searching**.

4. **Deliver**
   Provide the file path and the relevant line numbers immediately. Do not perform extensive secondary searches unless the first candidate is clearly wrong.

> [!TIP]
> If the user mentions a "button" or "action", grep for the button label AND `handleSubmit` or `onClick` to find the logic faster.
