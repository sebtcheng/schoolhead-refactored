import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';
import { getRoleGroup, normalizeRole } from '../config/roleGroups';

const ProtectedRoute = ({ children, allowedRoles, allowedGroups }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <LoadingScreen />;
    }

    // If not logged in, redirect to login
    if (!user) {
        const lastRole = localStorage.getItem('lastRole');
        const state = lastRole === 'School Head' ? { pathId: 'path_school_head' } : null;
        return <Navigate to="/login" replace state={state} />;
    }

    // Role Normalization: Map DB role names to UI Display Names
    const normalizedUserRole = normalizeRole(user.role);

    // Determine derived role for Super Users (if impersonating)
    const isSuperUser = normalizedUserRole === 'Super User';
    const impersonatedRole = sessionStorage.getItem('impersonatedRole');
    const effectiveRole = (isSuperUser && impersonatedRole) ? normalize(impersonatedRole) : normalizedUserRole;
    const userGroup = getRoleGroup(effectiveRole);

    // Group-based check
    if (allowedGroups && !allowedGroups.includes(userGroup)) {
        // Super User override for group checks (they should access all domain dashboards)
        if (isSuperUser) {
            return children;
        }
        return <Navigate to="/" replace />;
    }

    // Role-based check
    if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
        const isViewingAsSuperUser = sessionStorage.getItem('isViewingAsSuperUser') === 'true';
        if (isSuperUser && isViewingAsSuperUser) {
            // Allow Super User to access any impersonated dashboard
            return children;
        }
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute;
