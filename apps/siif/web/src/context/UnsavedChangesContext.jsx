// ─── Unsaved Changes Guard ────────────────────────────────────────────────────
// Lets a SIIF page with unsaved edits stop the user from leaving it by accident.
// The app uses HashRouter, which has no useBlocker, so the guard covers:
//   • BottomNav tabs:  they call confirmLeave() before navigate()
//   • Back / Forward:  a capturing popstate listener runs before React Router's,
//                      cancels the move and asks first
// Refresh / tab close can't show a custom dialog; the page keeps its own
// beforeunload handler for the browser's built-in prompt.

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { confirmUnsaved } from '../components/utilization/confirmUnsaved';
import { UnsavedChangesContext } from './unsavedChanges';

export function UnsavedChangesProvider({ children }) {
    const location = useLocation();
    const navigate = useNavigate();
    // { isDirty, canSave, save: () => Promise<boolean> } from the page on screen, or null
    const guardRef = useRef(null);
    const promptingRef = useRef(false);
    // The history entry being shown, so a cancelled Back can be put back
    const entryRef = useRef(null);

    const setGuard = useCallback((guard) => {
        guardRef.current = guard;
    }, []);

    /** Resolves true when it's fine to leave: nothing unsaved, saved now, or discarded. */
    const confirmLeave = useCallback(async () => {
        const guard = guardRef.current;
        if (!guard?.isDirty) return true;
        if (promptingRef.current) return false;
        promptingRef.current = true;
        try {
            const choice = await confirmUnsaved({ canSave: guard.canSave });
            if (choice === 'save') return await guard.save();
            return choice === 'leave';
        } finally {
            promptingRef.current = false;
        }
    }, []);

    useEffect(() => {
        entryRef.current = { state: window.history.state, href: window.location.href };
    }, [location]);

    useEffect(() => {
        const onPopState = (e) => {
            if (!guardRef.current?.isDirty || !entryRef.current) return;
            // Capturing listeners on window run before React Router's, so stopping here
            // keeps the router (and the page's unsaved state) where it is
            e.stopImmediatePropagation();
            const target = window.location.hash.replace(/^#/, '') || '/';
            window.history.pushState(entryRef.current.state, '', entryRef.current.href);
            confirmLeave().then(ok => {
                if (ok) navigate(target);
            });
        };
        window.addEventListener('popstate', onPopState, true);
        return () => window.removeEventListener('popstate', onPopState, true);
    }, [confirmLeave, navigate]);

    const value = useMemo(() => ({ setGuard, confirmLeave }), [setGuard, confirmLeave]);

    return (
        <UnsavedChangesContext.Provider value={value}>
            {children}
        </UnsavedChangesContext.Provider>
    );
}
