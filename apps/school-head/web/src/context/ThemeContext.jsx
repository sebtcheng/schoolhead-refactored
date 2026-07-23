import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Default to light mode or local storage if no user
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') === 'dark';
        }
        return false;
    });

    // loading state to prevent flash of wrong theme
    const [loading, setLoading] = useState(true);

    const { user, loading: authLoading } = useAuth();
    
    // 1. Sync Theme with User Session (Local Preference)
    useEffect(() => {
        if (!authLoading) {
            setLoading(false);
        }
    }, [authLoading]);

    // 2. Apply Theme to HTML (Local Only)
    useEffect(() => {
        const root = window.document.documentElement;
        if (isDarkMode) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    // 3. User Explicitly Toggles Theme (Local Only for now)
    const toggleTheme = () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        // Persistence to backend can be added later if needed via /api/user-settings
    };

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
            {!loading && children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
