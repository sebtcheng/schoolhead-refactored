import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
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
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [lockChecked, setLockChecked] = useState(false);
    const [isLocked, setIsLocked] = useState(true); // Fail-closed default

    // Resolve admin bypass: privileged roles or ?preview=true
    const role = user?.role || localStorage.getItem('userRole') || '';
    const isBypassRole = ['Admin', 'Super Admin', 'Super User', 'School Division Office', 'Regional Office'].includes(role);
    const isPreviewParam = searchParams.get('preview') === 'true';
    const canBypass = isBypassRole || isPreviewParam;

    useEffect(() => {
        if (canBypass) {
            // Privileged users skip the lock check
            setIsLocked(false);
            setLockChecked(true);
            return;
        }

        // Fetch nexus_module_locks from the school-head API
        const controller = new AbortController();
        fetch('api/settings/nexus_module_locks', { signal: controller.signal })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && data.value) {
                    try {
                        const locks = JSON.parse(data.value);
                        setIsLocked(locks.hasOwnProperty('siif') ? Boolean(locks['siif']) : true);
                    } catch {
                        setIsLocked(true); // Fail-closed on parse error
                    }
                } else {
                    setIsLocked(true); // Fail-closed when no data
                }
            })
            .catch(() => {
                setIsLocked(true); // Fail-closed on network error
            })
            .finally(() => {
                setLockChecked(true);
            });

        return () => controller.abort();
    }, [canBypass]);

    // Not logged in
    if (!user) {
        return <Navigate to="/" replace />;
    }

    // Still checking lock status
    if (!lockChecked) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#EAF6FB]">
                <div className="text-center space-y-3">
                    <div className="w-8 h-8 border-4 border-[#06345F] border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Verifying access...
                    </p>
                </div>
            </div>
        );
    }

    // Module locked — redirect non-bypass users back to Nexus
    if (isLocked && !canBypass) {
        return <Navigate to="/nodes-dashboard" replace />;
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
