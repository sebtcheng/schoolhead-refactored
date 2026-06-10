import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser]           = useState(null);
    const [token, setToken]         = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const ssoToken = urlParams.get('sso_token');

        if (ssoToken) {
            console.log('🛡️ [OS-AUTH] Processing SSO token...');
            try {
                const payloadBase64 = ssoToken.split('.')[1];
                const decodedUser = JSON.parse(atob(payloadBase64));
                
                localStorage.setItem('os_token', ssoToken);
                localStorage.setItem('siif_token', ssoToken);
                localStorage.setItem('token', ssoToken);
                
                setToken(ssoToken);
                setUser(decodedUser);

                // 3. Clean the sso_token query parameter from the URL address bar
                window.history.replaceState({}, document.title, window.location.pathname);
                
                // 4. Force reload or redirect to the dashboard path
                window.location.href = '/dashboard'; 
            } catch (error) {
                console.error('SIIF SSO login parsing failed:', error);
            }
            setAuthLoading(false);
            return;
        }

        // On mount — restore session from localStorage
        const stored = localStorage.getItem('os_token');
        console.log('🛡️ [OS-AUTH] Checking session...');
        if (stored) {
            try {
                const payload = JSON.parse(atob(stored.split('.')[1]));
                console.log('🔑 [OS-AUTH] Found stored token for:', payload.email || payload.uid);
                // Check expiry
                if (payload.exp && Date.now() / 1000 > payload.exp) {
                    console.warn('[OS-AUTH] Token expired. Clearing session.');
                    localStorage.removeItem('os_token');
                } else {
                    setToken(stored);
                    setUser(payload);
                }
            } catch (e) {
                console.error('[OS-AUTH] Could not parse stored token:', e);
                localStorage.removeItem('os_token');
            }
        }
        setAuthLoading(false);
    }, []);

    const login = (userData, newToken) => {
        console.log('✅ [OS-AUTH] Setting session for:', userData.email || userData.uid);
        localStorage.setItem('os_token', newToken);
        // Also write 'siif_token' and 'token' so the SIIF app (same domain)
        // picks it up automatically without a separate login
        localStorage.setItem('siif_token', newToken);
        localStorage.setItem('token', newToken);
        setToken(newToken);
        setUser(userData);
    };

    const logout = () => {
        console.log('🚪 [OS-AUTH] Logging out...');
        localStorage.removeItem('os_token');
        localStorage.removeItem('siif_token');
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, authLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
