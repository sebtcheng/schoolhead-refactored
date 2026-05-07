import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import SIIFDashboard from './pages/SIIFDashboard';
import SIIFFormsHub  from './pages/SIIFFormsHub';
import SIIFUtilization from './pages/SIIFUtilization';
import SIIFSettings  from './pages/SIIFSettings';
import BottomNav from './components/BottomNav';

const AppContent = ({ user }) => {
    return (
        <div className="min-h-screen bg-slate-50">
            <Routes>
                <Route path="/" element={<SIIFDashboard user={user} />} />
                <Route path="/forms"       element={<SIIFFormsHub user={user} />} />
                <Route path="/utilization" element={<SIIFUtilization user={user} />} />
                <Route path="/settings"    element={<SIIFSettings user={user} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <BottomNav />
        </div>
    );
};

const App = () => {
    const [authReady, setAuthReady] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');

        if (urlToken) {
            localStorage.setItem('siif_token', urlToken);
            window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        }

        const token = localStorage.getItem('siif_token') || localStorage.getItem('token');

        if (!token) {
            setAuthReady(true);
            return;
        }

        try {
            const base64Payload = token.split('.')[1];
            const decoded = JSON.parse(atob(base64Payload));
            console.log('🎫 [SIIF Auth] Decoded Payload:', decoded);
            
            if (decoded.exp && decoded.exp * 1000 < Date.now()) {
                localStorage.removeItem('siif_token');
                setAuthReady(true);
                return;
            }

            const mappedUser = {
                ...decoded,
                token,
                school_id: decoded.school_id || decoded.schoolId || decoded.uid || decoded.id || decoded.sub,
                first_name: decoded.first_name || decoded.firstName || 'School Head',
                school_name: decoded.school_name || decoded.schoolName || '',
                division: decoded.division || 'N/A',
                region: decoded.region || 'N/A'
            };
            console.log('👤 [SIIF Auth] Mapped User:', mappedUser);
            setUser(mappedUser);
        } catch (err) {
            console.error('[SIIF Auth] Failed to decode token:', err);
        }

        setAuthReady(true);
    }, []);

    if (!authReady) {
        return (
            <div className="min-h-screen bg-[#0038A8] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white/70 text-sm font-medium">Loading SIIF...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-[#0038A8] flex items-center justify-center p-6 text-slate-800">
                <div className="bg-white rounded-3xl p-8 text-center max-w-xs w-full shadow-2xl">
                    <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <h2 className="text-xl font-bold mb-2">Session Required</h2>
                    <p className="text-slate-500 text-sm mb-6">Please log in through InsightEd to access the SIIF module.</p>
                    <a
                        href={import.meta.env.VITE_MAIN_APP_URL || 'http://localhost:5173'}
                        className="block w-full py-3 bg-[#0038A8] text-white rounded-2xl font-bold text-center"
                    >
                        Go to InsightEd Login
                    </a>
                </div>
            </div>
        );
    }

    return (
        <Router>
            <AppContent user={user} />
        </Router>
    );
};

export default App;
