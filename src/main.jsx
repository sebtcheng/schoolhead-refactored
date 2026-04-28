import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// GUARANTEE: Expose React globally for any third-party dependencies 
// that rely on it instead of ES module imports.
window.React = window.React || React;

// GLOBAL FETCH INTERCEPTOR: Fix Staging API Routing
// Redirects /api/* requests to /insighted-staging/api/* when running on staging
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  if (typeof resource === 'string' && resource.startsWith('api/')) {
    if (window.location.pathname.includes('/insighted-staging')) {
      // Prepend the staging base path if we are in the staging environment
      resource = '/insighted-staging' + resource;
    }
  }
  return originalFetch(resource, config);
};

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