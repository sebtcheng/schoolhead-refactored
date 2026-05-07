import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// 🔬 MASTER TINKERER: SIIF UI & API INTERCEPTOR
(function tinker() {
    console.group('🔬 Master Tinkerer: SIIF UI Monitoring Active');
    window.addEventListener('error', (e) => console.error('❌ [SIIF UI CRASH]', e.message, e.filename, e.lineno, e.error));
    window.addEventListener('unhandledrejection', (e) => console.error('❌ [SIIF PROMISE FAIL]', e.reason));
    
    // Intercept Fetch for SIIF API Auditing
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        let [resource, config] = args;
        const start = Date.now();
        console.log(`🌐 [SIIF UI REQ] ${resource}`, config || {});
        try {
            const res = await originalFetch(resource, config);
            console.log(`✅ [SIIF UI RES] ${resource} | Status: ${res.status} | Time: ${Date.now() - start}ms`);
            if (!res.ok) {
                const cloned = res.clone();
                const errorBody = await cloned.text().catch(() => 'non-text-response');
                console.error('⚠️ [SIIF UI FAIL]', { url: resource, status: res.status, body: errorBody });
            }
            return res;
        } catch (err) {
            console.error('🔥 [SIIF UI FATAL]', resource, err.message);
            throw err;
        }
    };
    console.groupEnd();
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
