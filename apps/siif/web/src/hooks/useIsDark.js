import { useEffect, useState } from 'react';

const readIsDark = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

/** Tracks the app's `html.dark` class so SVG/chart colors can follow the theme. */
export const useIsDark = () => {
    const [isDark, setIsDark] = useState(readIsDark);
    useEffect(() => {
        const obs = new MutationObserver(() => setIsDark(readIsDark()));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);
    return isDark;
};
