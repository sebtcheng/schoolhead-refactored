import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        // EFD Engineer Patch: Skip automatic scroll reset for EFD routes ONLY if we 
        // have a saved scroll position waiting to be restored manually.
        // We now delay the cleanup of this flag in EFDHome/EFDMonitoring 
        // to ensure this global component has a window to see it.
        const isEFDRoute = pathname === '/efd-monitoring' || pathname === '/efd-dashboard';
        const hasSavedScroll = sessionStorage.getItem('efd_scrollY');
        
        if (isEFDRoute && hasSavedScroll) {
            console.log(`[ScrollToTop] Skipping reset for ${pathname} (Pending restoration)`);
            return;
        }

        window.scrollTo({
            top: 0,
            left: 0,
            behavior: 'instant'
        });
    }, [pathname]);

    return null;
}
