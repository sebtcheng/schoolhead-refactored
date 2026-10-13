import React from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../school-head/web/src/context/AuthContext';

// Pages
import SIIFFormsHub from './pages/SIIFFormsHub';
import SIIFUtilization from './pages/SIIFUtilization';
import SIIFSettings from './pages/SIIFSettings';

// Components
import BottomNav from './components/BottomNav';

// Use the global ServiceWorkerContext only — ThemeContext is handled globally by App.jsx
import { ServiceWorkerProvider } from './context/ServiceWorkerContext';
import { UnsavedChangesProvider } from './context/UnsavedChangesContext';

import './styles/siif.css';

// The old SIIF Dashboard page was split into the Forms and Utilization pages' Dashboard
// tabs; old links (?view=utilization) still land on the matching one.
const DashboardRedirect = () => {
    const [searchParams] = useSearchParams();
    return searchParams.get('view') === 'utilization'
        ? <Navigate to="/siif/utilization?tab=dashboard" replace />
        : <Navigate to="/siif/forms?tab=dashboard" replace />;
};

const SIIFModuleContent = () => {
    const { user, token } = useAuth();

    // The user should already be logged in if they reached this route via App.jsx
    if (!user) {
        return <Navigate to="/" replace />;
    }

    return (
        <UnsavedChangesProvider>
            <div className="siif-module-root min-h-screen">
                <div className="siif-app-layout">
                    {/* School Head nav: Forms (optional), Utilization, Settings; each has its own Dashboard tab */}
                    <BottomNav />
                    <div className="siif-main-area pb-24 min-[1001px]:pb-6">
                        <Routes>
                            {/* Opening SIIF (e.g. from the Nexus card) lands on Forms › Dashboard */}
                            <Route index element={<Navigate to="forms" replace />} />
                            <Route path="dashboard" element={<DashboardRedirect />} />
                            {/* Optional SIIF plan — independent from Utilization, no deadline */}
                            <Route path="forms" element={<SIIFFormsHub user={user} token={token} />} />
                            <Route path="utilization" element={<SIIFUtilization user={user} token={token} />} />
                            <Route path="settings" element={<SIIFSettings user={user} token={token} />} />
                            <Route path="*" element={<Navigate to="/siif/forms" replace />} />
                        </Routes>
                    </div>
                </div>
            </div>
        </UnsavedChangesProvider>
    );
};

export default function SIIFModule() {
    return (
        <ServiceWorkerProvider>
            <SIIFModuleContent />
        </ServiceWorkerProvider>
    );
}
