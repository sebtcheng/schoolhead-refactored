import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// GUARANTEE: Expose React globally for any third-party dependencies 
// that rely on it instead of ES module imports.
window.React = window.React || React;

// MASTER TINKERER: UI & API INTERCEPTOR + Staging Routing
(function tinker() {
    console.group('🔬 Master Tinkerer: Extreme Verbose Monitoring Active');
    window.addEventListener('error', (e) => console.error('❌ [UI CRASH]', e.message, e.filename, e.lineno, e.error));
    window.addEventListener('unhandledrejection', (e) => console.error('❌ [PROMISE FAIL]', e.reason));
    
    // Intercept Fetch for API Auditing and Staging Routing
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        let [resource, config] = args;
        
        // Staging environment routing fix
        if (typeof resource === 'string' && resource.startsWith('api/')) {
            if (window.location.pathname.includes('/insighted-staging')) {
                // Prepend the staging base path if we are in the staging environment
                resource = '/insighted-staging' + resource;
            }
        }
        
        const start = Date.now();
        console.log(`🌐 [API REQ] ${resource}`, config || {});
        try {
            const res = await originalFetch(resource, config);
            console.log(`✅ [API RES] ${resource} | Status: ${res.status} | Time: ${Date.now() - start}ms`);
            if (!res.ok) {
                const cloned = res.clone();
                const errorBody = await cloned.text().catch(() => 'non-text-response');
                console.error('⚠️ [API FAIL]', { url: resource, status: res.status, body: errorBody });
            }
            return res;
        } catch (err) {
            console.error('🔥 [API FATAL]', resource, err.message);
            throw err;
        }
    };
    console.groupEnd();
})();

import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { ServiceWorkerProvider } from './context/ServiceWorkerContext'
import { AuthProvider } from './context/AuthContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <ServiceWorkerProvider>
          <App />
        </ServiceWorkerProvider>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
)