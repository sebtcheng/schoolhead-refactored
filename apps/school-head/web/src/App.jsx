import { HashRouter as Router, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';

// ... (lines 3-118 remain same, but I can't express that in one chunk easily if imports are at top and usage at bottom. I'll use 2 chunks)

import { AnimatePresence } from 'framer-motion'; // <--- IMPORT THIS
import SuperUserFloatingSwitch from './components/SuperUserFloatingSwitch'; // Super User Switch
import { useState, useEffect } from 'react'; // Ensure React hooks are imported
import SchoolHeadChatWidget from './components/SchoolHeadChatWidget'; // School Head Chat Prototype

// Auth
import Login from './Login';
import Register from './Register';
import { AuthProvider, useAuth } from './context/AuthContext';

// Dashboards
import AdminDashboard from './modules/AdminDashboard';
import UserManagement from './modules/UserManagement';
import LocationManagement from './modules/LocationManagement';
import UserProfile from './modules/UserProfile';
import Activity from './modules/Activity';
import MyActivityDashboard from './modules/MyActivityDashboard';
import Outbox from './modules/Outbox';
import SyncCenter from './modules/SyncCenter';
import ProtectedRoute from './components/ProtectedRoute';
import PasscodeSetupPrompt from './components/PasscodeSetupPrompt';
// import ChatModule from './modules/ChatModule'; // Chatbot Module Removed
import { ROLE_GROUPS, NEXUS_AUTHORIZED_EMAILS } from './config/roleGroups';

// Forms
import Leaderboard from './modules/Leaderboard';

// School Head Modular Flow
import ModularDashboard from './components/ModularDashboard';
import Unit1SchoolIdentity from './components/modular/Unit1SchoolIdentity';
import Unit2Learners from './components/modular/Unit2Learners';
import Unit3OrganizedClasses from './components/modular/Unit3OrganizedClasses';
import Unit4LearnerProfile from './components/modular/Unit4LearnerProfile';
import Unit5ShiftingModality from './components/modular/Unit5ShiftingModality';
import Unit6SchoolResources from './components/modular/Unit6SchoolResources';
import Unit7PhysicalFacilities from './components/modular/Unit7PhysicalFacilities';
import Unit8SchoolLocation from './components/modular/Unit8SchoolLocation';
import Unit9Infrastructure from './components/modular/Unit9Infrastructure';

// Nexus & Drafts
import NodesDashboard from './modules/NexusDashboard';
import SchoolHeadQuickStart from './guides/SchoolHeadQuickStart';
import LegacyGuideWrapper from './modules/LegacyGuideWrapper';
import SIIFModule from './modules/siif/SIIFModule';

// --- WRAPPER COMPONENT TO HANDLE LOCATION ---
const AnimatedRoutes = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // List of public paths that don't require authentication
    const publicPaths = ['/', '/login', '/register', '/adminlogin', '/nodes-dashboard'];

    // If auth is finished loading and no user is found on a non-public path, redirect to login
    if (!loading && !user && !publicPaths.includes(location.pathname)) {
      console.log("[App] No user session found on protected route. Redirecting to login...");
      const lastRole = localStorage.getItem('lastRole');
      console.log("[App] Retrieved lastRole for redirection:", lastRole);

      // Role to PathId Mapping for Portal Redirection
      const roleToPathId = {
        'School Head': 'path_school_head',
        'school_head': 'path_school_head',
        'Implementing Agency': 'path_agencies',
        'Central Office': 'path_central_office'
      };

      const pathId = lastRole ? roleToPathId[lastRole] : null;
      console.log("[App] Calculated pathId:", pathId);
      const state = pathId ? { pathId } : null;

      navigate('/login', { replace: true, state });
    }
  }, [user, loading, location.pathname, navigate]);

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [checkingMaintenance, setCheckingMaintenance] = useState(true);

  // Check Maintenance Status periodically (Reduced from per-route check to every 5 mins)
  useEffect(() => {
    const controller = new AbortController();

    const checkMaintenance = async () => {
      try {
        const res = await fetch('api/settings/maintenance_mode', { signal: controller.signal });
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        setMaintenanceMode(data.value === 'true');
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Maintenance Check Failed:", err);
        }
      } finally {
        setCheckingMaintenance(false);
      }
    };

    checkMaintenance(); // Initial check on mount

    const intervalId = setInterval(checkMaintenance, 300000); // Poll every 5 minutes

    return () => {
      clearInterval(intervalId);
      controller.abort();
    };
  }, []); // Run ONLY on mount

  if (checkingMaintenance) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Initializing InsightED...</p>
        </div>
      </div>
    );
  }

  const role = localStorage.getItem('userRole');
  const isProtected = location.pathname !== '/' && location.pathname !== '/register';
  const isAdmin = role === 'Admin' || role === 'Super Admin' || role === 'Super User';

  // if (maintenanceMode && isProtected && !isAdmin) {
  //   return <MaintenanceScreen />;
  // }

  return (
    <Routes>
      {/* Authentication & Public Landing */}
      <Route path="/" element={<Navigate to="/nodes-dashboard" replace />} />
      <Route path="/login" element={<Login mode="login" />} />
      <Route path="/register" element={<Login mode="register" />} />
      <Route path="/guide/school-head" element={<LegacyGuideWrapper />} />

      {/* Dashboards */}
      <Route path="/nodes-dashboard" element={<NodesDashboard />} />

      <Route path="/admin-dashboard" element={<AdminDashboard />} />
      <Route path="/user-management" element={<ProtectedRoute allowedRoles={['School Division Office', 'Regional Office', 'Super User']}><UserManagement /></ProtectedRoute>} />
      <Route path="/location-management" element={<ProtectedRoute allowedRoles={['School Division Office', 'Regional Office', 'Super User']}><LocationManagement /></ProtectedRoute>} />

      {/* School Head Modular Flow */}
      <Route
        path="/modular-dashboard"
        element={
          <ProtectedRoute allowedRoles={['School Head']}>
            <ModularDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-activity"
        element={
          <ProtectedRoute allowedRoles={['School Head']}>
            <MyActivityDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activity-dashboard"
        element={
          <ProtectedRoute allowedRoles={['School Head']}>
            <MyActivityDashboard />
          </ProtectedRoute>
        }
      />
      {/* ESF7 Draft removed */}
      <Route
        path="/modular/unit-1"
        element={
          <ProtectedRoute allowedRoles={['School Head']}>
            <Unit1SchoolIdentity />
          </ProtectedRoute>
        }
      />
      <Route
        path="/modular/unit-2"
        element={
          <ProtectedRoute allowedRoles={['School Head']}>
            <Unit2Learners />
          </ProtectedRoute>
        }
      />
      <Route
        path="/modular/unit-3"
        element={
          <ProtectedRoute allowedRoles={['School Head']}>
            <Unit3OrganizedClasses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/modular/unit-4"
        element={
          <ProtectedRoute allowedRoles={['School Head']}>
            <Unit4LearnerProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/modular/unit-5"
        element={
          <ProtectedRoute allowedRoles={['School Head']}>
            <Unit5ShiftingModality />
          </ProtectedRoute>
        }
      />
      <Route
        path="/modular/unit-6"
        element={
          <ProtectedRoute allowedRoles={['School Head']}>
            <Unit6SchoolResources />
          </ProtectedRoute>
        }
      />
      <Route
        path="/modular/unit-7"
        element={
          <ProtectedRoute allowedRoles={['School Head']}>
            <Unit7PhysicalFacilities />
          </ProtectedRoute>
        }
      />
      <Route
        path="/modular/unit-8"
        element={
          <ProtectedRoute allowedRoles={['School Head']}>
            <Unit8SchoolLocation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/modular/unit-9"
        element={
          <ProtectedRoute allowedRoles={['School Head']}>
            <Unit9Infrastructure />
          </ProtectedRoute>
        }
      />
      {/* <Route path="/chat" element={<ChatModule />} /> */}

      {/* Utilities */}
      <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
      <Route path="/activities" element={<ProtectedRoute><Activity /></ProtectedRoute>} />
      <Route path="/outbox" element={<ProtectedRoute><Outbox /></ProtectedRoute>} />
      <Route path="/sync-center" element={<ProtectedRoute allowedRoles={['School Head']}><SyncCenter /></ProtectedRoute>} />

      {/* SIIF Module */}
      <Route path="/siif/*" element={<ProtectedRoute allowedRoles={['School Head']}><SIIFModule /></ProtectedRoute>} />

      {/* School Head Forms (Redirected to Modular Units) */}
      <Route path="/school-profile" element={<Navigate to="/modular/unit-1" replace />} />
      <Route path="/school-information" element={<Navigate to="/modular/unit-1" replace />} />
      <Route path="/enrolment" element={<Navigate to="/modular/unit-2" replace />} />
      <Route path="/organized-classes" element={<Navigate to="/modular/unit-3" replace />} />
      <Route path="/learner-statistics" element={<Navigate to="/modular/unit-4" replace />} />
      <Route path="/shifting-modalities" element={<Navigate to="/modular/unit-5" replace />} />
      <Route path="/school-resources" element={<Navigate to="/modular/unit-6" replace />} />
      <Route path="/physical-facilities" element={<Navigate to="/modular/unit-7" replace />} />
      <Route path="/leaderboard" element={<ProtectedRoute allowedRoles={['School Head']}><Leaderboard /></ProtectedRoute>} />

      {/* Hidden Admin Login Route */}
      <Route path="/adminlogin" element={<Login />} />
    </Routes>
  );
};

import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import ForceUpdateModal from './components/ForceUpdateModal';
import { api } from "./lib/api";

function App() {
  return (
    <GlobalErrorBoundary>
      <Router>
        <AppContent />
      </Router>
    </GlobalErrorBoundary>
  );
}

const AppContent = () => {
  const location = useLocation();
  const showChatFloating = false; // Floating button removed per user request. Dedicated button added to Login.

  return (
    <>
      <ScrollToTop />
      <ForceUpdateModal />
      <SuperUserFloatingSwitch />
      {/* <ChatWidget showFloatingButton={showChatFloating} /> */}
      <PasscodeSetupPrompt />
      <SchoolHeadChatWidget />
      <AnimatedRoutes />
    </>
  );
};

export default App;