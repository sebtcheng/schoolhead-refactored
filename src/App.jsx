import { HashRouter as Router, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';

// ... (lines 3-118 remain same, but I can't express that in one chunk easily if imports are at top and usage at bottom. I'll use 2 chunks)

import { AnimatePresence } from 'framer-motion'; // <--- IMPORT THIS
import MaintenanceScreen from './components/MaintenanceScreen'; // <--- IMPORT MAINTENANCE SCREEN
import SuperUserFloatingSwitch from './components/SuperUserFloatingSwitch'; // Super User Switch
import ChatWidget from './components/ChatWidget'; // Chatbot Widget
import { useState, useEffect } from 'react'; // Ensure React hooks are imported

// Auth
import Login from './Login';
import Register from './Register';
import { AuthProvider, useAuth } from './context/AuthContext';

// Dashboards
import EngineerDashboard from './modules/EngineerDashboard';
import RegionalEngineerDashboard from './modules/RegionalEngineerDashboard';
import EngineerProjects from './modules/EngineerProjects';

// import LguDashboard from './modules/lgu'; // Import LguDashboard
// import LguProjects from './modules/LguProjects';
import SchoolHeadDashboard from './modules/SchoolHeadDashboard';
import HRDashboard from './modules/HRDashboard';
import AdminDashboard from './modules/AdminDashboard';
import MonitoringDashboard from './modules/MonitoringDashboard';
import SchoolManagement from './modules/SchoolManagement';
import UserManagement from './modules/UserManagement';
import LocationManagement from './modules/LocationManagement';
import DummyDashboard from './modules/DummyDashboard';
import SchoolJurisdictionList from './modules/SchoolJurisdictionList';
import SchoolAuditView from './modules/SchoolAuditView';
import UserProfile from './modules/UserProfile';
import Activity from './modules/Activity';
import MyActivityDashboard from './modules/MyActivityDashboard';
import ProjectGallery from './modules/ProjectGallery';
import Outbox from './modules/Outbox';
import EngineerOutbox from './modules/EngineerOutbox';
import SuperAdminDashboard from './modules/SuperAdminDashboard';
import SuperUserSelector from './modules/SuperUserSelector';
import FinanceDashboard from './modules/FinanceDashboard';
import AgencyDashboard from './modules/AgencyDashboard';
import LguDashboard from './modules/LguDashboard';
import NonDepEdDashboard from './modules/NonDepEdDashboard'; // Dedicated Dashboard
import LguForms from './modules/LguForms'; // Import newly created LguForms
import LguProjectDetails from './modules/LguProjectDetails'; // Import LguProjectDetails
import PSIP from './modules/PSIP'; // Import PSIP
import SyncCenter from './modules/SyncCenter'; // Sync Center for modular units
import ProtectedRoute from './components/ProtectedRoute'; // Import ProtectedRoute
import PasscodeSetupPrompt from './components/PasscodeSetupPrompt'; // <--- IMPORT THIS
import EFDHome from './modules/EFDHome';
import EFDMonitoring from './modules/EFDMonitoring';
import EFDNewconMonitoring from './modules/EFDNewconMonitoring';
import EFDMotherMoa from './modules/EFDMotherMoa';
import BEFFDashboard from './modules/BEFFDashboard';
import ChatModule from './modules/ChatModule'; // <--- RESTORED THIS
import EducationalDashboard from './modules/EducationalDashboard';
import ProjectSummaryDashboard from './modules/ProjectSummaryDashboard';
import { ROLE_GROUPS } from './config/roleGroups';
import { EFDFilterProvider } from './context/EFDFilterContext';



// Forms
import SchoolForms from './modules/SchoolForms';
import EngineerForms from './modules/EngineerForms';

// Form Imports (School Head)
import SchoolProfile from './forms/SchoolProfile';
import SchoolInformation from './forms/SchoolInformation';
import Enrolement from './forms/Enrolment';
import OrganizedClasses from './forms/OrganizedClasses';
import ShiftingModalities from './forms/ShiftingModalities';
import SchoolResources from './forms/SchoolResources';
import PhysicalFacilities from './forms/PhysicalFacilities';
import LearnerStatistics from './forms/LearnerStatistics';

// Form Imports (DepEd Engineer)
import EngineerSchoolResources from './forms/EngineerSchoolResources';
import DamageAssessment from './forms/DamageAssessment';
import ProjectMonitoring from './forms/ProjectMonitoring';
import SiteInspection from './forms/SiteInspection';
import MaterialInventory from './forms/MaterialInventory';
import NewProjects from './modules/NewProjects';
import DetailedProjInfo from './modules/DetailedProjInfo';
import ProjectValidation from './modules/ProjectValidation';
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
import ESF7Draft from './forms/ESF7Draft';
import NSPPDraft from './forms/NSPPDraft';
import ESF7Review from './modules/ESF7Review';
import LaunchPad from './components/LaunchPad';
import SchoolHeadQuickStart from './guides/SchoolHeadQuickStart';
import LegacyGuideWrapper from './modules/LegacyGuideWrapper';
import DivisionEngineerQuickStart from './guides/DivisionEngineerQuickStart';
import EFDEngineerQuickStart from './guides/EFDEngineerQuickStart';




// --- WRAPPER COMPONENT TO HANDLE LOCATION ---
const AnimatedRoutes = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // List of public paths that don't require authentication
    const publicPaths = ['/', '/login', '/register', '/adminlogin', '/chat'];

    
    // If auth is finished loading and no user is found on a non-public path, redirect to login
    if (!loading && !user && !publicPaths.includes(location.pathname)) {
      console.log("[App] No user session found on protected route. Redirecting to login...");
      const lastRole = localStorage.getItem('lastRole');
      console.log("[App] Retrieved lastRole for redirection:", lastRole);
      
      // Role to PathId Mapping for Portal Redirection
      const roleToPathId = {
        'School Head': 'path_school_head',
        'school_head': 'path_school_head',
        'Regional Office': 'path_ro_sd',
        'School Division Office': 'path_ro_sd',
        'DepEd Engineer': 'path_engineers',
        'Division Engineer': 'path_engineers',
        'Architect': 'path_engineers',
        'Regional Engineer': 'path_engineers',
        'Engineer': 'path_engineers',
        'Non-DepEd Engineer': 'path_engineers',
        'Implementing Agency': 'path_agencies',
        'PGO': 'path_agencies', 'CGO': 'path_agencies', 'MGO': 'path_agencies', 'DPWH': 'path_agencies', 'CSO': 'path_agencies',
        'EFD': 'path_efd', 'EFD Engineer': 'path_efd', 'HRODI': 'path_efd', 'Central Office': 'path_efd'
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
        const res = await fetch('/api/settings/maintenance_mode', { signal: controller.signal });
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
      {/* Authentication */}
      <Route path="/" element={<LaunchPad />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/guide/school-head" element={<LegacyGuideWrapper />} />
      <Route path="/guide/division-engineer" element={<DivisionEngineerQuickStart />} />
      <Route path="/guide/efd-engineer" element={<EFDEngineerQuickStart />} />



        {/* Dashboards */}
        <Route path="/engineer-dashboard" element={<EngineerDashboard />} />
        <Route path="/regional-engineer-dashboard" element={<ProtectedRoute allowedRoles={['Division Engineer', 'Regional Engineer', 'Architect', 'DepEd Engineer', 'Super User', 'EFD Engineer', 'EFD']}><RegionalEngineerDashboard /></ProtectedRoute>} />
        <Route path="/non-deped-dashboard" element={<NonDepEdDashboard />} />
        {/* <Route path="/lgu" element={<LguDashboard />} /> */}
        {/* <Route path="/lgu-form" element={<LguForm />} /> */}
        {/* <Route path="/lgu-projects" element={<LguProjects />} /> */}
        <Route path="/engineer-projects" element={<EngineerProjects />} />
        <Route path="/super-admin" element={<Navigate to="/super-user-selector" replace />} />
        <Route path="/finance-dashboard" element={<FinanceDashboard />} />
        <Route 
          path="/nodes-dashboard" 
          element={
            <ProtectedRoute allowedRoles={['School Head']}>
              <NodesDashboard />
            </ProtectedRoute>
          } 
        />
        <Route path="/lgu-dashboard" element={<LguDashboard />} />
        <Route path="/lgu-form" element={<LguForms />} /> {/* Mapped to LguForms */}
        <Route path="/lgu-project-details/:id" element={<LguProjectDetails />} />

      {/* Super User Selector (Protected) */}
      <Route
        path="/super-user-selector"
        element={
          <ProtectedRoute allowedRoles={['Super User']}>
            <SuperUserSelector />
          </ProtectedRoute>
        }
      />

      <Route path="/schoolhead-dashboard" element={<SchoolHeadDashboard />} />
      <Route path="/hr-dashboard" element={<HRDashboard />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
      <Route path="/monitoring-dashboard" element={<MonitoringDashboard />} />
      <Route path="/efd-dashboard" element={<EFDHome />} />
      <Route path="/agency-dashboard" element={<AgencyDashboard />} />
      <Route path="/efd-monitoring" element={<EFDMonitoring />} />
      <Route path="/beff-dashboard" element={<BEFFDashboard />} />
      <Route path="/efd-newcon-monitoring" element={<EFDNewconMonitoring />} />
      <Route path="/efd-mother-moa" element={<EFDMotherMoa />} />
      <Route path="/school-management" element={<SchoolManagement />} />
      <Route path="/user-management" element={<ProtectedRoute allowedRoles={['School Division Office', 'Regional Office', 'Super User']}><UserManagement /></ProtectedRoute>} />
      <Route path="/location-management" element={<ProtectedRoute allowedRoles={['School Division Office', 'Regional Office', 'Super User']}><LocationManagement /></ProtectedRoute>} />
      <Route path="/jurisdiction-schools" element={<SchoolJurisdictionList />} />
      <Route path="/school-audit" element={<SchoolAuditView />} />
      <Route path="/esf7-review" element={<Navigate to="/esf7/review" replace />} />
      <Route path="/esf7/review" element={<ProtectedRoute allowedRoles={['Super User', 'School Division Office']}><ESF7Review /></ProtectedRoute>} />
      <Route path="/educational-dashboard" element={<ProtectedRoute allowedGroups={[ROLE_GROUPS.EDUCATIONAL_ADMIN]}><EducationalDashboard /></ProtectedRoute>} />
      <Route path="/project-summary-dashboard" element={<ProtectedRoute allowedGroups={[ROLE_GROUPS.TECHNICAL_FINANCE]}><ProjectSummaryDashboard /></ProtectedRoute>} />

      <Route path="/dummy-forms" element={<DummyDashboard />} />
      <Route path="/psip" element={<PSIP />} />

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
        <Route
          path="/draft/esf7"
          element={
            <ProtectedRoute allowedRoles={['School Head']}>
              <ESF7Draft />
            </ProtectedRoute>
          }
        />
        <Route
          path="/draft/nspp"
          element={
            <ProtectedRoute allowedRoles={['School Head']}>
              <NSPPDraft />
            </ProtectedRoute>
          }
        />
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
        <Route path="/chat" element={<ChatModule />} />

      {/* Menus */}
      <Route path="/school-forms" element={<SchoolForms />} />
      <Route path="/engineer-forms" element={<EngineerForms />} />

      {/* Utilities */}
      <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
      <Route path="/activities" element={<ProtectedRoute><Activity /></ProtectedRoute>} />
      <Route path="/outbox" element={<ProtectedRoute><Outbox /></ProtectedRoute>} />
      <Route path="/sync-center" element={<ProtectedRoute allowedRoles={['School Head']}><SyncCenter /></ProtectedRoute>} />
      <Route path="/engineer-outbox" element={<ProtectedRoute><EngineerOutbox /></ProtectedRoute>} />

      {/* School Head Forms */}
      <Route path="/school-profile" element={<ProtectedRoute allowedRoles={['School Head']}><SchoolProfile /></ProtectedRoute>} />
      <Route path="/school-information" element={<ProtectedRoute allowedRoles={['School Head']}><SchoolInformation /></ProtectedRoute>} />
      <Route path="/enrolment" element={<ProtectedRoute allowedRoles={['School Head']}><Enrolement /></ProtectedRoute>} />
      <Route path="/organized-classes" element={<ProtectedRoute allowedRoles={['School Head']}><OrganizedClasses /></ProtectedRoute>} />
        <Route path="/shifting-modalities" element={<ProtectedRoute allowedRoles={['School Head']}><ShiftingModalities /></ProtectedRoute>} />
        <Route path="/school-resources" element={<ProtectedRoute allowedRoles={['School Head']}><SchoolResources /></ProtectedRoute>} />
        <Route path="/physical-facilities" element={<ProtectedRoute allowedRoles={['School Head']}><PhysicalFacilities /></ProtectedRoute>} />
      <Route path="/learner-statistics" element={<ProtectedRoute allowedRoles={['School Head']}><LearnerStatistics /></ProtectedRoute>} />
      <Route path="/project-validation" element={<ProtectedRoute allowedRoles={['School Head']}><ProjectValidation /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute allowedRoles={['School Head']}><Leaderboard /></ProtectedRoute>} />

      {/* DepEd Engineer Forms */}
      <Route path="/engineer-school-resources" element={<ProtectedRoute allowedRoles={['DepEd Engineer', 'Division Engineer', 'Architect', 'Super User']}><EngineerSchoolResources /></ProtectedRoute>} />
      <Route path="/damage-assessment" element={<ProtectedRoute allowedRoles={['DepEd Engineer', 'Division Engineer', 'Architect', 'Super User']}><DamageAssessment /></ProtectedRoute>} />
      <Route path="/project-monitoring" element={<ProtectedRoute allowedRoles={['DepEd Engineer', 'Division Engineer', 'Architect', 'Super User']}><ProjectMonitoring /></ProtectedRoute>} />
      <Route path="/site-inspection" element={<ProtectedRoute allowedRoles={['DepEd Engineer', 'Division Engineer', 'Architect', 'Super User']}><SiteInspection /></ProtectedRoute>} />
      <Route path="/material-inventory" element={<ProtectedRoute allowedRoles={['DepEd Engineer', 'Division Engineer', 'Architect', 'Super User']}><MaterialInventory /></ProtectedRoute>} />
      <Route path="/new-project" element={<ProtectedRoute allowedRoles={['DepEd Engineer', 'Division Engineer', 'Architect', 'Super User', 'EFD Engineer', 'HRODI Engineer', 'EFD']}><NewProjects /></ProtectedRoute>} />
      <Route path="/project-details/:id" element={<ProtectedRoute><DetailedProjInfo /></ProtectedRoute>} />
      <Route path="/project-gallery" element={<ProtectedRoute><ProjectGallery /></ProtectedRoute>} />
      <Route path="/project-gallery/:projectId" element={<ProtectedRoute><ProjectGallery /></ProtectedRoute>} />
      <Route path="/project-gallery/:projectId" element={<ProtectedRoute><ProjectGallery /></ProtectedRoute>} />

      {/* Hidden Admin Login Route */}
      <Route path="/adminlogin" element={<Login />} />
    </Routes>
  );
};

import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import ForceUpdateModal from './components/ForceUpdateModal';

function App() {
  return (
    <GlobalErrorBoundary>
      <EFDFilterProvider>
        <Router>
          <AppContent />
        </Router>
      </EFDFilterProvider>
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
      <ChatWidget showFloatingButton={showChatFloating} />
      <PasscodeSetupPrompt />
      <AnimatedRoutes />
    </>
  );
};

export default App;