import React, { createContext, useContext, useState, useEffect } from 'react';

const ServiceWorkerContext = createContext(null);

export const useServiceWorker = () => {
    return useContext(ServiceWorkerContext);
};

export const ServiceWorkerProvider = ({ children }) => {
    const [wb, setWb] = useState(null);
    const [registration, setRegistration] = useState(null);
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            const basePath = import.meta.env.BASE_URL || '/';
            const swFileName = import.meta.env.DEV ? 'dev-sw.js?dev-sw' : 'sw.js';
            // Version is auto-injected from package.json by vite.config.js at build time
            const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
            const swUrl = `${basePath}${swFileName}?v=${APP_VERSION}`.replace('//', '/');

            const registerSW = async () => {
                try {
                    const reg = await navigator.serviceWorker.register(swUrl, {
                        scope: basePath,
                        type: import.meta.env.DEV ? 'module' : 'classic'
                    });
                    setRegistration(reg);
                    console.log('InsightEd PWA Registered at:', reg.scope);

                    // Helper: track a newly installing worker and fire modal when ready
                    const trackInstall = (worker) => {
                        worker.addEventListener('statechange', () => {
                            console.log('[SW] Worker state changed to:', worker.state);
                            // 'installed' + existing controller = update waiting to activate
                            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('[SW] New version waiting — showing update modal.');
                                setIsUpdateAvailable(true);
                            }
                        });
                    };

                    // 1. Page loaded and update was already waiting (e.g. user refreshed)
                    if (reg.waiting && navigator.serviceWorker.controller) {
                        console.log('[SW] Waiting worker found on load.');
                        setIsUpdateAvailable(true);
                    }

                    // 2. Update was in the middle of installing when page loaded
                    if (reg.installing) {
                        trackInstall(reg.installing);
                    }

                    // 3. Listen for future updates found during the session
                    reg.addEventListener('updatefound', () => {
                        console.log('[SW] updatefound — new worker installing...');
                        if (reg.installing) {
                            trackInstall(reg.installing);
                        }
                    });

                    // 4. Periodic background check every 30 minutes
                    setInterval(() => { reg.update(); }, 30 * 60 * 1000);

                    // 5. Check on visibility restore (user switches back to tab/app)
                    document.addEventListener('visibilitychange', () => {
                        if (document.visibilityState === 'visible') {
                            console.log('[SW] Visibility restored — checking for updates...');
                            reg.update();
                        }
                    });

                    // 6. Check on window focus (desktop browser tab focus)
                    window.addEventListener('focus', () => {
                        console.log('[SW] Window focused — checking for updates...');
                        reg.update();
                    });

                    // 7. URL flag for manual force-update during support
                    if (window.location.search.includes('forceUpdate=1')) {
                        console.warn('[SW] forceUpdate=1 flag detected — triggering hard reset.');
                        // hardReset is defined below, call after a tick
                        setTimeout(() => hardReset(), 100);
                    }

                } catch (err) {
                    console.error('PWA Registration Failed:', err);
                }
            };

            registerSW();

            // When SW controller changes (new SW activated), reload to load new assets
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    console.log('[SW] Controller changed — reloading for new version.');
                    refreshing = true;
                    window.location.reload();
                }
            });
        }
    }, []);

    const updateApp = async () => {
        if (registration && registration.waiting) {
            try {
                // HIDE MODAL IMMEDIATELY
                setIsUpdateAvailable(false);

                // HARD RESET: Clear all caches before updating
                console.log('Clearing all caches for hard reset...');
                const cacheKeys = await caches.keys();
                await Promise.all(
                    cacheKeys.map(key => caches.delete(key))
                );
                console.log('All caches cleared.');

                // Send message to SW to skip waiting
                console.log('Sending SKIP_WAITING to waiting worker:', registration.waiting.scriptURL);
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });

                // FALLBACK: Force reload if controllerchange doesn't fire in 1s
                setTimeout(() => {
                    console.warn('Fallback reload: controllerchange failed to fire.');
                    window.location.reload();
                }, 1000);

            } catch (error) {
                console.error('Error during hard reset update:', error);
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                setTimeout(() => window.location.reload(), 1000);
            }
        } else {
            // If waiting worker went away, just reload
            window.location.reload();
        }
    };

    const checkForUpdates = async () => {
        if (!registration) {
            console.log('No SW registration found, cannot check for updates.');
            return false;
        }
        try {
            console.log('Manual update check triggered...');
            await registration.update();
            console.log('registration.update() completed.');

            // Check immediately after update() if there's a new worker installing or waiting
            console.log('SW Status - Installing:', !!registration.installing, 'Waiting:', !!registration.waiting, 'Active:', !!registration.active);
            
            if (registration.installing || registration.waiting) {
                console.log('Update found in installing/waiting state!');
                return true;
            }

            console.log('No update found on network (sw.js byte-comparison matched).');
            return false;
        } catch (error) {
            console.error('Error checking for updates:', error);
            return false;
        }
    };

    const hardReset = async () => {
        try {
            console.log('Manual hard reset triggered.');
            // 1. Clear Caches
            const cacheKeys = await caches.keys();
            await Promise.all(
                cacheKeys.map(key => caches.delete(key))
            );
            console.log('Caches cleared.');

            // 2. Unregister SW to force fresh fetch
            if (registration) {
                await registration.unregister();
                console.log('Service Worker unregistered.');
            }

            // 3. Reload
            window.location.reload(true);
        } catch (error) {
            console.error('Hard reset failed:', error);
            window.location.reload(); // Force reload anyway
        }
    };

    /**
     * PUSH NOTIFICATIONS: Request permission and register browser subscription.
     * Integrates with the backend /api/save-subscription endpoint.
     */
    const subscribeToPushNotifications = async () => {
        if (!registration) {
            console.error('[Push] No service worker registration available');
            return false;
        }

        try {
            // 1. Fetch the Public Key from our server
            const response = await fetch('api/vapid-public-key');
            if (!response.ok) throw new Error("Failed to fetch VAPID key");
            const { publicKey } = await response.json();
            
            if (!publicKey) {
                console.error("[Push] VAPID Public Key missing from server response");
                return false;
            }

            // 2. Request Browser Permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn('[Push] Notification permission denied by user');
                return false;
            }

            // 3. Register the subscription with the browser's Push Service
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: publicKey
            });

            // 4. Send the subscription object to our PostgreSQL backend
            const saveResponse = await fetch('api/save-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription,
                    deviceInfo: navigator.userAgent
                })
            });

            if (saveResponse.ok) {
                console.log('✅ [Push] Subscription synced with InsightEd backend.');
                return true;
            } else {
                const errData = await saveResponse.json();
                console.error('❌ [Push] Failed to save subscription to server:', errData.error);
                return false;
            }
        } catch (error) {
            console.error('❌ [Push] Subscription process failed:', error);
            return false;
        }
    };

    const value = {
        isUpdateAvailable,
        updateApp,
        checkForUpdates,
        registration,
        hardReset,
        subscribeToPushNotifications
    };

    return (
        <ServiceWorkerContext.Provider value={value}>
            {children}
        </ServiceWorkerContext.Provider>
    );
};
