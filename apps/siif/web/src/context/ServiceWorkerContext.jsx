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
        if ('serviceWorker' in navigator && !import.meta.env.DEV) {
            const basePath = import.meta.env.BASE_URL || '/';
            const swFileName = import.meta.env.DEV ? 'dev-sw.js?dev-sw' : 'sw.js';
            const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
            const joinChar = swFileName.includes('?') ? '&' : '?';
            const swUrl = `${basePath}${swFileName}${joinChar}v=${APP_VERSION}`.replace('//', '/');

            const registerSW = async () => {
                try {
                    const reg = await navigator.serviceWorker.register(swUrl, {
                        scope: basePath,
                        type: import.meta.env.DEV ? 'module' : 'classic'
                    });
                    setRegistration(reg);

                    const trackInstall = (worker) => {
                        worker.addEventListener('statechange', () => {
                            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                                setIsUpdateAvailable(true);
                            }
                        });
                    };

                    if (reg.waiting && navigator.serviceWorker.controller) {
                        setIsUpdateAvailable(true);
                    }

                    if (reg.installing) {
                        trackInstall(reg.installing);
                    }

                    reg.addEventListener('updatefound', () => {
                        if (reg.installing) {
                            trackInstall(reg.installing);
                        }
                    });

                    setInterval(() => { reg.update(); }, 30 * 60 * 1000);

                } catch (err) {
                    console.error('PWA Registration Failed:', err);
                }
            };

            registerSW();

            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                }
            });
        }
    }, []);

    const updateApp = async () => {
        if (registration && registration.waiting) {
            try {
                setIsUpdateAvailable(false);
                const cacheKeys = await caches.keys();
                await Promise.all(cacheKeys.map(key => caches.delete(key)));
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                setTimeout(() => window.location.reload(), 1000);
            } catch (error) {
                console.error('Error during update:', error);
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                setTimeout(() => window.location.reload(), 1000);
            }
        } else {
            window.location.reload();
        }
    };

    const checkForUpdates = async () => {
        if (!registration) return false;
        try {
            await registration.update();
            return !!(registration.installing || registration.waiting);
        } catch (error) {
            return false;
        }
    };

    const hardReset = async () => {
        try {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map(key => caches.delete(key)));
            if (registration) await registration.unregister();
            window.location.reload(true);
        } catch (error) {
            window.location.reload();
        }
    };

    const subscribeToPushNotifications = async () => {
        // Simplified for SIIF
        return false;
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
