// Minimal db.js for SIIF to avoid crashes from migrated components
export async function initDB() {
    return {
        get: async () => null,
        put: async () => {},
        transaction: () => ({
            objectStore: () => ({
                clear: async () => {},
                put: async () => {}
            }),
            done: Promise.resolve()
        })
    };
}

export async function clearProjectsCache() { return Promise.resolve(); }
export async function saveUnitDraft() { return Promise.resolve(); }
export async function getUnitDraft() { return Promise.resolve(null); }
export async function saveSchoolToCache() { return Promise.resolve(); }
