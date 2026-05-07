# Skill: Extreme Verbose Logging (Diagnostic Tool)

**Version:** 1.0.0
**Domain:** Full-Stack Debugging, System Observability
**Framework:** Google Antigravity Vibe Coding
**Tags:** #Debugging #Logging #Observability #MasterTinkerer

## 🎯 Core Directive
This skill enables **Extreme Verbose Logging** across the application, providing granular visibility into the execution flow, state changes, API network traffic, and Service Worker registration sequences. It acts as a diagnostic overlay designed to make hidden bugs (like MIME type errors, silent Promise rejections, and caching loops) glaringly obvious in the browser console and terminal.

## 🛠️ Implementation Guide

### 1. The Global Interceptor (Frontend)
When enabled, inject the following snippet into the frontend entry file (e.g., `src/main.jsx`):

```javascript
// MASTER TINKERER: UI & API INTERCEPTOR
(function tinker() {
    console.group('🔬 Master Tinkerer: Extreme Verbose Monitoring Active');
    
    // 1. Unhandled Error Catchers
    window.addEventListener('error', (e) => console.error('❌ [UI CRASH]', e.message, e.filename, e.lineno, e.error));
    window.addEventListener('unhandledrejection', (e) => console.error('❌ [PROMISE FAIL]', e.reason));
    
    // 2. Fetch API Network Auditing
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        let [resource, config] = args;
        
        // Include any environment-specific overrides here...

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
```

### 2. Service Worker & PWA Diagnostic Mode
To debug PWA issues (e.g. `SecurityError` and MIME types), ensure `vite.config.js` specifies `devOptions.enabled: true` and the `swUrl` safely joins query params (e.g., `dev-sw.js?dev-sw&v=1.0.25`).

**Expected Logs:**
- `[SW] Worker state changed to: ...`
- `[SW] Controller changed — reloading for new version.`
- `PWA Registration Failed: ...` (should now be resolved if Vite correctly serves the module).

### 3. Backend Express Observability (Optional Extension)
Wrap sensitive routes in standard try-catch blocks with high-granularity `console.error` dumps of `req.body`, `req.headers`, and PostgreSQL pool connections to quickly spot `500 Internal Server Errors`.

## 🚀 Usage Instructions
Use this skill when encountering silent failures, "connection timeout" logs, or browser security blocks. Monitor the terminal and Chrome DevTools console. The strict emoji logging scheme (🔬, ❌, 🌐, ✅, ⚠️, 🔥) acts as a visual filter to speed up root-cause analysis.
