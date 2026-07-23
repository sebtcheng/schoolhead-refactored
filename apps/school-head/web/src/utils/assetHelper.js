/**
 * assetHelper.js — Shared asset URL resolver
 *
 * Priority: VITE_API_BASE_URL env var → window.location.origin (same-origin fallback)
 * Handles: /api/asset/:id paths, /uploads/ legacy paths, absolute URLs, data URIs, raw base64.
 */

const DEBUG_ASSETS = import.meta.env.DEV;

/**
 * Resolves a raw asset path to an absolute URL.
 * @param {string} rawPath
 * @param {{ download?: boolean }} opts
 */
export const resolveAssetUrl = (rawPath, opts = {}) => {
    if (!rawPath) return rawPath;
    if (rawPath.startsWith('http') || rawPath.startsWith('data:')) return rawPath;

    if (rawPath.startsWith('api/') || rawPath.startsWith('/uploads/')) {
        const vBase = import.meta.env.VITE_API_BASE_URL;
        
        // If VITE_API_BASE_URL is explicitly set, use it
        if (vBase) {
            const qs = opts.download ? '?download=1' : '';
            return `${vBase}${rawPath}${qs}`;
        }

        // Production fallback for sub-path awareness (proxied environments)
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        const isDev = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

        if (!isDev) {
            // In production, we assume a HashRouter-like environment where './' is the app root.
            // This is safer for sub-path deployments (e.g. /stride/ or /staging/).
            const appBase = import.meta.env.BASE_URL || './';
            const cleanBase = appBase.endsWith('/') ? appBase : `${appBase}/`;
            const cleanPath = rawPath.startsWith('/') ? rawPath.substring(1) : rawPath;
            const qs = opts.download ? '?download=1' : '';
            return `${cleanBase}${cleanPath}${qs}`;
        }

        // Development fallback
        const origin = window.location.origin;
        const qs = opts.download ? '?download=1' : '';
        return `${origin}${rawPath}${qs}`;
    }

    return rawPath;
};

/**
 * Resolves a document field (path, data URI, or raw base64) to a usable href.
 * @param {string} value
 * @param {{ download?: boolean }} opts
 */
export const resolveDocUrl = (value, opts = {}) => {
    if (!value) return '#';
    if (value.startsWith('data:') || value.startsWith('http') || value.startsWith('blob:') || value.startsWith('local:')) return value;
    if (value.startsWith('/')) return resolveAssetUrl(value, opts);
    // Legacy: raw base64 string
    return `data:application/pdf;base64,${value}`;
};
/**
 * Resolves an API path to an absolute URL, aware of the current environment base.
 * @param {string} apiPath e.g. "api/esf7/upload" or "api/esf7/upload"
 */
export const resolveApiUrl = (apiPath) => {
    if (!apiPath) return apiPath;
    if (apiPath.startsWith('http')) return apiPath;

    let resolvedUrl = '';
    const vApiUrl = import.meta.env.VITE_API_URL;
    
    if (vApiUrl) {
        const cleanPath = apiPath.startsWith('/') ? apiPath.substring(1) : apiPath;
        const cleanApiUrl = vApiUrl.endsWith('/') ? vApiUrl : `${vApiUrl}/`;
        resolvedUrl = `${cleanApiUrl}${cleanPath}`;
    } else {
        const appBase = import.meta.env.BASE_URL || '/';
        const cleanBase = appBase.endsWith('/') ? appBase : `${appBase}/`;
        const cleanPath = apiPath.startsWith('/') ? apiPath.substring(1) : apiPath;
        
        let finalBase = cleanBase;
        
        // FOOLPROOF STAGING DETECTION:
        // If the current URL includes "insighted-staging" but the base doesn't, force it.
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        if (path.includes('/insighted-staging/') && !finalBase.includes('insighted-staging')) {
            finalBase = '/insighted-staging/';
            console.warn(`⚠️ [API-Path-Correction] Detected staging environment via URL. Forcing base to: ${finalBase}`);
        } else if (finalBase === './') {
            finalBase = '/';
        }
        
        resolvedUrl = `${finalBase}${cleanPath}`;
    }


    if (import.meta.env.DEV || window.location.hostname !== 'localhost') {
        console.log(`🔗 [API-Resolve] "${apiPath}" -> "${resolvedUrl}" (Base: ${import.meta.env.BASE_URL})`);
    }

    return resolvedUrl;
};

