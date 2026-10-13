// Context + hook for the unsaved-changes guard (provider: UnsavedChangesContext.jsx).

import { createContext, useContext } from 'react';

export const UnsavedChangesContext = createContext(null);

const FALLBACK = { setGuard: () => {}, confirmLeave: async () => true };

/** { setGuard, confirmLeave }; outside the provider, leaving is always allowed. */
export function useUnsavedChanges() {
    return useContext(UnsavedChangesContext) || FALLBACK;
}
