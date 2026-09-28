import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../../school-head/web/src/context/AuthContext';

// Pages
import SIIFDashboard from './pages/SIIFDashboard';
import SIIFFormsHub from './pages/SIIFFormsHub';
import SIIFUtilization from './pages/SIIFUtilization';
import SIIFSettings from './pages/SIIFSettings';

// Components
import BottomNav from './components/BottomNav';

// Use the global ServiceWorkerContext only — ThemeContext is handled globally by App.jsx
import { ServiceWorkerProvider } from './context/ServiceWorkerContext';

import './styles/siif.css';

const SIIFModuleContent = () => {
    const { user, token } = useAuth();

    // The user should already be logged in if they reached this route via App.jsx
    if (!user) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="siif-module-root min-h-screen">
            <div className="siif-app-layout siif-fullwidth-layout">
                {/* Sidebar and BottomNav hidden completely for School Head per directive */}
                <div className="siif-main-area siif-no-sidebar pb-12 w-full px-4 sm:px-6 lg:px-8">
                    <Routes>
                        <Route index element={<SIIFUtilization user={user} token={token} />} />
                        <Route path="utilization" element={<SIIFUtilization user={user} token={token} />} />
                        <Route path="*" element={<Navigate to="/siif/utilization" replace />} />
                    </Routes>
                </div>
            </div>
        </div>
    );
};

export default function SIIFModule() {
    return (
        <ServiceWorkerProvider>
            <SIIFModuleContent />
        </ServiceWorkerProvider>
    );
}
