import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Icons 
import { TbHomeEdit, TbCloudUpload, TbClipboardList, TbSchool, TbArrowsLeftRight, TbChartBar, TbFileCheck } from "react-icons/tb";
import { LuCompass } from "react-icons/lu";
import { FiSettings, FiCheckSquare, FiLogOut, FiMessageSquare, FiHome, FiUser, FiList, FiPlus, FiDollarSign, FiGrid, FiBookOpen, FiUsers } from "react-icons/fi";
import { motion } from 'framer-motion';
import { getRoleGroup, ROLE_GROUPS } from '../config/roleGroups';

const BottomNav = ({ userRole: propRole }) => {
    const { user, logout, confirmLogout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Robust role detection: Prop -> Context -> Cache
    const userRole = propRole || user?.role || localStorage.getItem('userRole');

    // If no role is detected yet, don't show the nav bar (prevents flashes/errors)
    if (!userRole) return null;

    // --- SUPER USER OVERRIDE ---
    let effectiveRole = userRole;

    // Normalization logic for database vs UI role strings
    if (effectiveRole === 'deped_engineer' || effectiveRole === 'DepEd Engineer') effectiveRole = 'Division Engineer';
    if (effectiveRole === 'hrodi_engineer' || effectiveRole === 'HRODI Engineer' || effectiveRole === 'EFD' || effectiveRole === 'HRODI') effectiveRole = 'EFD Engineer';
    if (effectiveRole === 'non_deped_engineer') effectiveRole = 'Non-DepEd Engineer';
    if (effectiveRole === 'engineer' || effectiveRole === 'Engineer') effectiveRole = 'Division Engineer';
    if (effectiveRole === 'school_head') effectiveRole = 'School Head';
    if (effectiveRole === 'lgu') effectiveRole = 'Local Government Unit';
    if (effectiveRole === 'Architect') effectiveRole = 'Division Engineer'; // Architect follows same flow as Division Engineer

    // Normalize Implementing Agency sub-roles
    if (['PGO', 'CGO', 'MGO', 'DPWH', 'CSO'].includes(effectiveRole)) {
        effectiveRole = 'Implementing Agency';
    }

    if (user?.role === 'Super User') {
        const impRole = sessionStorage.getItem('impersonatedRole');
        if (impRole) effectiveRole = impRole;
    }

    // Determine Group
    const userGroup = getRoleGroup(effectiveRole);

    // --- CONFIGURATION BY ROLE ---
    const navConfigs = {

        'Non-DepEd Engineer': [
            { label: 'Home', path: '/non-deped-dashboard', icon: TbHomeEdit },
            { label: 'Projects', path: '/engineer-projects', icon: TbClipboardList },
            { label: 'Chat', path: '/chat', icon: FiMessageSquare },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],
        'Local Government Unit': [
            { label: 'Home', path: '/lgu-dashboard', icon: TbHomeEdit },
            { label: 'Projects', path: '/lgu-dashboard', icon: TbClipboardList },
            { label: 'Chat', path: '/chat', icon: FiMessageSquare },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],
        'School Head': [
            { label: 'Home', path: '/my-activity', icon: FiHome },
            { label: 'Units', path: '/modular-dashboard', icon: LuCompass },
            { label: 'Guide', path: '/guide/school-head', icon: TbSchool, highlight: true },
            { label: 'Profile', path: '/profile', icon: FiUser },
        ],

        'Division Engineer': [
            { label: 'Home', path: '/engineer-dashboard', icon: TbHomeEdit },
            { label: 'Projects', path: '/engineer-projects', icon: TbClipboardList },
            { label: 'Guide', path: '/guide/division-engineer', icon: FiBookOpen },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],
        'Admin': [
            { label: 'Home', path: '/admin-dashboard', icon: FiGrid },
            { label: 'Chat', path: '/chat', icon: FiMessageSquare },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],
        'Human Resource': [
            { label: 'Home', path: '/hr-dashboard', icon: FiGrid },
            { label: 'Chat', path: '/chat', icon: FiMessageSquare },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],
        'Regional Office': [
            { label: 'Home', path: '/monitoring-dashboard', icon: TbHomeEdit },
            { label: 'Schools', path: '/school-management', icon: TbSchool },
            { label: 'Users', path: '/user-management', icon: FiUsers },
            { label: 'Location', path: '/location-management', icon: LuCompass },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],
        'Regional Engineer': [
            { label: 'Home', path: '/regional-engineer-dashboard', icon: TbHomeEdit },
            { label: 'Lookup', path: '/regional-engineer-lookup', icon: FiUsers },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],
        'School Division Office': [
            { label: 'Home', path: '/monitoring-dashboard', icon: TbHomeEdit },
            { label: 'Schools', path: '/school-management', icon: TbSchool },
            { label: 'Users', path: '/user-management', icon: FiUsers },
            { label: 'Location', path: '/location-management', icon: LuCompass },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],
        'Central Office': [
            { label: 'Home', path: '/monitoring-dashboard', icon: TbHomeEdit },
            { label: 'Infra', path: '/monitoring-dashboard', state: { activeTab: 'infra', resetFilters: true }, icon: TbClipboardList },
            { label: 'Chat', path: '/chat', icon: FiMessageSquare },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],

        'Central Office Finance': [
            { label: 'Home', path: '/finance-dashboard', icon: TbHomeEdit },
            { label: 'Chat', path: '/chat', icon: FiMessageSquare },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],

        'Masterlist': [
            { label: 'Home', path: '/psip', state: { activeTab: 'home' }, icon: TbHomeEdit },
            { label: 'Data', path: '/psip', state: { activeTab: 'data' }, icon: TbChartBar },
            { label: 'Chat', path: '/chat', icon: FiMessageSquare },
            { label: 'Settings', path: '/psip', state: { activeTab: 'settings' }, icon: FiSettings },
        ],

        'EFD Engineer': [
            { label: 'Home', path: '/efd-dashboard', icon: TbHomeEdit },
            { label: 'Projects', path: '/efd-monitoring', icon: TbClipboardList },
            { label: 'Mother MOA', path: '/efd-mother-moa', icon: TbFileCheck },
            // { label: 'Monitoring', path: '/efd-newcon-monitoring', icon: TbChartBar },
            { label: 'Chat', path: '/chat', icon: FiMessageSquare },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],
        'Implementing Agency': [
            { label: 'Home', path: '/agency-dashboard', icon: TbHomeEdit },
            { label: 'Deployment', path: '/agency-dashboard', state: { activeTab: 'deployment' }, icon: TbClipboardList },
            { label: 'Chat', path: '/chat', icon: FiMessageSquare },
            { label: 'Settings', path: '/profile', icon: FiSettings },
        ],
    };

    // Override first item based on Group if applicable
    let currentNavItems = navConfigs[effectiveRole];

    if (currentNavItems && currentNavItems.length > 0) {
        if (userGroup === ROLE_GROUPS.EDUCATIONAL_ADMIN) {
            // Group 1: Ensure first item is the Dashboard
            // For now, keep existing Home but if we create a dedicated Group 1 Dashboard we link it here
            // currentNavItems[0] = { label: 'Dashboard', path: '/educational-dashboard', icon: FiGrid };
        } else if (userGroup === ROLE_GROUPS.TECHNICAL_FINANCE) {
            // Group 2: Ensure first item is Project Summary
            // currentNavItems[0] = { label: 'Projects', path: '/project-summary', icon: TbClipboardList };
        }
    }


    // --- SUPER USER INJECTION ---
    // REMOVED: Moved to Floating Button
    const finalNavItems = currentNavItems;

    // If role exists but not in config (unexpected), don't show anything or show safe fallback
    if (!finalNavItems) return null;

    const isSchoolHead = effectiveRole === 'School Head';

    return createPortal(
        <div className="fixed bottom-0 left-0 w-full z-[1000]">
            {/* FAB Button for School Head */}
            {isSchoolHead && (
                <div className="absolute left-1/2 -top-8 -translate-x-1/2 z-[1001]">
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => navigate('/nodes-dashboard')}
                        className="w-16 h-16 bg-[#10346B] text-white rounded-full flex items-center justify-center shadow-xl shadow-blue-900/40 border-4 border-white"
                        title="Back to Nodes"
                    >
                        <FiGrid size={32} />
                    </motion.button>
                </div>
            )}

            <div className="h-[85px] bg-white border-t border-slate-100 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] flex items-center px-4">
                <div className="w-full flex justify-between items-center max-w-md mx-auto">
                    {finalNavItems.map((item, idx) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                            <React.Fragment key={item.label}>
                                {isSchoolHead && idx === 2 && <div className="w-16" />} {/* Gap for FAB */}
                                <button
                                    className={`flex-1 flex flex-col items-center justify-center h-full bg-transparent border-none cursor-pointer group transition-all ${item.highlight && !isActive ? 'bg-blue-50/50 rounded-2xl' : ''}`}
                                    onClick={() => {
                                        if (item.logout) {
                                            confirmLogout();
                                            return;
                                        }
                                        
                                        // Preserve impersonation UID if present
                                        let targetPath = item.path;
                                        if (user?.role === 'Super User') {
                                            const impUid = sessionStorage.getItem('impersonatedUid');
                                            if (impUid && targetPath && !targetPath.includes('uid=')) {
                                                targetPath += (targetPath.includes('?') ? '&' : '?') + `uid=${impUid}`;
                                            }
                                        }
                                        
                                        navigate(targetPath, { state: { ...(item.state || {}), refreshTrigger: Date.now() } });
                                    }}
                                >
                                    <Icon
                                        size={22}
                                        className={`mb-1 transition-all duration-300 ${isActive ? 'text-[#10346B] scale-110 drop-shadow-sm' : (item.highlight ? 'text-blue-600 animate-pulse' : 'text-slate-300 group-hover:text-slate-500')}`}
                                    />
                                    <span className={`text-[10px] font-bold transition-colors ${isActive ? 'text-[#10346B]' : (item.highlight ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-500')}`}>
                                        {item.label}
                                    </span>
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BottomNav;