// Minimal db.js for SIIF to provide local buffer fallback
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

export async function saveUnitDraft(schoolId, draftData) {
    try {
        if (!schoolId || !draftData) return;
        const key = `siif_draft_${schoolId}`;
        localStorage.setItem(key, JSON.stringify({
            timestamp: Date.now(),
            data: draftData
        }));
    } catch (e) {
        console.warn('Local draft caching warning:', e);
    }
}

export async function getUnitDraft(schoolId) {
    try {
        if (!schoolId) return null;
        const key = `siif_draft_${schoolId}`;
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.data || null;
    } catch (e) {
        console.warn('Local draft retrieval warning:', e);
        return null;
    }
}

export async function saveSchoolToCache() { return Promise.resolve(); }
