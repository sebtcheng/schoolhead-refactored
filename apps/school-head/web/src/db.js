// src/db.js
import { openDB } from 'idb';

const DB_NAME = 'InsightEd_Outbox';
// Store names to distinguish between user roles
const SH_STORE = 'pending_requests'; // Original store for School Head
const ENG_STORE = 'engineer_pending'; // New store for Engineer
const PROJECTS_STORE = 'projects_cache'; // New store for caching projects
const GALLERY_STORE = 'gallery_cache'; // New store for caching gallery images
const DRAFT_SPACES_STORE = 'buildable_spaces_drafts'; // New store for draft spaces
const REPAIRS_STORE = 'facility_repairs'; // Store for offline facility repairs
const UNIT_1_DRAFT_STORE = 'unit_1_draft_store'; // New store for Unit 1 School Head drafts
const UNIT_DRAFTS_STORE = 'unit_drafts'; // Generic store for all unit drafts
const MODULAR_OUTBOX_STORE = 'modular_outbox'; // Outbox for completed modular units (Sync Center)

const SCHOOLS_STORE = 'schools_cache'; // Define constant at top

// UNIFIED DB VERSION — all functions must use THIS version 
const DB_VERSION = 13;
const OFFLINE_FILES_STORE = 'offline_files'; // Persistent local binaries

// 1. Initialize the Database
export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      // Ensure School Head store exists
      if (!db.objectStoreNames.contains(SH_STORE)) {
        db.createObjectStore(SH_STORE, { keyPath: 'id', autoIncrement: true });
      }
      // Create Engineer-specific store
      if (!db.objectStoreNames.contains(ENG_STORE)) {
        db.createObjectStore(ENG_STORE, { keyPath: 'id', autoIncrement: true });
      }
      // Create Projects cache store
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      }
      // Clear projects cache on version bump to remove old massive blobs
      if (oldVersion < 11 && db.objectStoreNames.contains(PROJECTS_STORE)) {
        console.log("Purging old PROJECT_STORE cache (Base64 Cleanup)...");
        // We can't use await inside upgrade easily, but we can clear it
        // Actually, just clearing is fine.
      }
      // Create Gallery cache store
      if (!db.objectStoreNames.contains(GALLERY_STORE)) {
        db.createObjectStore(GALLERY_STORE, { keyPath: 'projectId' });
      }
      // Create Schools cache store
      if (!db.objectStoreNames.contains(SCHOOLS_STORE)) {
        db.createObjectStore(SCHOOLS_STORE, { keyPath: 'school_id' });
      }
      // Create Draft Spaces store
      if (!db.objectStoreNames.contains(DRAFT_SPACES_STORE)) {
        db.createObjectStore(DRAFT_SPACES_STORE, { keyPath: 'uid' });
      }
      // Create Facility Repairs store (offline queue)
      if (!db.objectStoreNames.contains(REPAIRS_STORE)) {
        const repairStore = db.createObjectStore(REPAIRS_STORE, { keyPath: 'local_id', autoIncrement: true });
        repairStore.createIndex('iern', 'iern', { unique: false });
      }
      // Create Unit 1 Drafts store
      if (!db.objectStoreNames.contains(UNIT_1_DRAFT_STORE)) {
        db.createObjectStore(UNIT_1_DRAFT_STORE, { keyPath: 'iern' });
      }
      // Create Generic Unit Drafts store
      if (!db.objectStoreNames.contains(UNIT_DRAFTS_STORE)) {
        db.createObjectStore(UNIT_DRAFTS_STORE, { keyPath: 'id' });
      }
      // Create Modular Outbox store
      if (!db.objectStoreNames.contains(MODULAR_OUTBOX_STORE)) {
        db.createObjectStore(MODULAR_OUTBOX_STORE, { keyPath: 'id', autoIncrement: true });
      }
      // Create Offline Files store
      if (!db.objectStoreNames.contains(OFFLINE_FILES_STORE)) {
        db.createObjectStore(OFFLINE_FILES_STORE, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

// ==========================================
//        SCHOOL HEAD FUNCTIONS (Original)
// ==========================================

export async function addToOutbox(requestData) {
  const db = await initDB();
  return db.add(SH_STORE, {
    ...requestData,
    timestamp: new Date().toISOString(),
    status: 'pending'
  });
}

export async function getOutbox() {
  const db = await initDB();
  return db.getAll(SH_STORE);
}

export async function deleteFromOutbox(id) {
  const db = await initDB();
  return db.delete(SH_STORE, id);
}

// ==========================================
//        MODULAR OUTBOX FUNCTIONS (Sync Center)
// ==========================================

/**
 * Adds a completed unit submission to the modular outbox
 */
export async function addModularToOutbox(payload) {
  const db = await initDB();
  return db.add(MODULAR_OUTBOX_STORE, {
    ...payload,
    timestamp: new Date().toISOString(),
    status: 'pending'
  });
}

/**
 * Gets all pending units from the modular outbox
 */
export async function getModularOutbox() {
  const db = await initDB();
  return db.getAll(MODULAR_OUTBOX_STORE);
}

/**
 * Deletes a unit from the outbox after successful sync
 */
export async function deleteModularFromOutbox(id) {
  const db = await initDB();
  return db.delete(MODULAR_OUTBOX_STORE, id);
}

/**
 * Clears the modular outbox
 */
export async function clearModularOutbox() {
  const db = await initDB();
  const tx = db.transaction(MODULAR_OUTBOX_STORE, 'readwrite');
  await tx.objectStore(MODULAR_OUTBOX_STORE).clear();
  return tx.done;
}

// ==========================================
//        ENGINEER FUNCTIONS (New)
// ==========================================

/**
 * Saves an Engineer form request to the dedicated engineer outbox
 * @param {Object} requestData - contains { url, method, body, formName }
 */
export async function addEngineerToOutbox(requestData) {
  const db = await initDB();
  return db.add(ENG_STORE, {
    ...requestData,
    timestamp: new Date().toISOString(),
    status: 'pending'
  });
}

/**
 * Retrieves all pending forms specifically for the Engineer Sync Center
 */
export async function getEngineerOutbox() {
  const db = await initDB();
  return db.getAll(ENG_STORE);
}

/**
 * Deletes an Engineer request after successful sync to NeonSQL
 */
export async function deleteEngineerFromOutbox(id) {
  const db = await initDB();
  return db.delete(ENG_STORE, id);
}

// ==========================================
//        PROJECT CACHING FUNCTIONS
// ==========================================

/**
 * Caches the fetched projects list to IndexedDB
 * @param {Array} projects - List of project objects
 */
export async function cacheProjects(projects) {
  const db = await initDB();
  const tx = db.transaction(PROJECTS_STORE, 'readwrite');
  const store = tx.objectStore(PROJECTS_STORE);

  // Clear existing cache to ensure we have fresh data
  await store.clear();

  for (const project of projects) {
    await store.put(project);
  }

  return tx.done;
}

/**
 * Retrieves cached projects from IndexedDB
 */
export async function getCachedProjects() {
  const db = await initDB();
  return db.getAll(PROJECTS_STORE);
}

/**
 * Clears the entire projects cache (e.g., on logout to prevent cross-user data leakage)
 */
export async function clearProjectsCache() {
  const db = await initDB();
  const tx = db.transaction(PROJECTS_STORE, 'readwrite');
  await tx.objectStore(PROJECTS_STORE).clear();
  return tx.done;
}

/**
 * Caches gallery images for a specific project
 * @param {string} projectId 
 * @param {Array} images - List of image objects/urls
 */
export async function cacheGallery(projectId, images) {
  const db = await initDB();
  return db.put(GALLERY_STORE, { projectId, images, timestamp: Date.now() });
}

/**
 * Retrieves cached gallery images for a specific project
 * @param {string} projectId
 */
export async function getCachedGallery(projectId) {
  const db = await initDB();
  let entry = await db.get(GALLERY_STORE, projectId);
  if (!entry) entry = await db.get(GALLERY_STORE, String(projectId));
  if (!entry && !isNaN(projectId)) entry = await db.get(GALLERY_STORE, Number(projectId));
  return entry ? entry.images : [];
}

// ==========================================
//        SCHOOL CACHING FUNCTIONS (Offline Validation)
// ==========================================
// SCHOOLS_STORE is defined at the top of the file

/**
 * Caches the schools list for offline validation
 * @param {Array} schools - List of school objects
 */
export async function cacheSchools(schools) {
  const db = await initDB(); // Use unified initDB — same version, same upgrade

  const tx = db.transaction(SCHOOLS_STORE, 'readwrite');
  const store = tx.objectStore(SCHOOLS_STORE);

  // Clear old data and replace with fresh server data
  await store.clear();

  for (const school of schools) {
    await store.put(school);
  }

  await tx.done;
  console.log(`✅ [db.js] Cached ${schools.length} schools to IndexedDB.`);
}

/**
 * Saves or updates a single school record in the cache
 * @param {Object} school - The school object with school_id
 */
export async function saveSchoolToCache(school) {
  const db = await initDB();
  const tx = db.transaction(SCHOOLS_STORE, 'readwrite');
  await tx.objectStore(SCHOOLS_STORE).put(school);
  return tx.done;
}

/**
 * Retrieves a cached school by ID
 * @param {string} schoolId
 */
export async function getCachedSchool(schoolId) {
  const db = await initDB(); // Use unified initDB

  // Try exact match first
  let school = await db.get(SCHOOLS_STORE, schoolId);

  // Fallback: Try as string if it was a number, or vice versa
  if (!school && typeof schoolId === 'string') {
    school = await db.get(SCHOOLS_STORE, Number(schoolId));
  } else if (!school && typeof schoolId === 'number') {
    school = await db.get(SCHOOLS_STORE, String(schoolId));
  }

  return school;
}

/**
 * Returns count of cached schools (for debugging)
 */
export async function getCachedSchoolCount() {
  const db = await initDB();
  return db.count(SCHOOLS_STORE);
}

// ==========================================
//        BUILDABLE SPACES DRAFTS (IndexedDB)
// ==========================================
// DRAFT_SPACES_STORE is defined at the top

/**
 * Saves the current list of buildable spaces as a draft for the user
 * @param {string} uid - User ID
 * @param {Array} spaces - Array of space objects
 */
export async function saveSpaceDraft(uid, spaces) {
  const db = await initDB();
  return db.put(DRAFT_SPACES_STORE, { uid, spaces, timestamp: Date.now() });
}

/**
 * Retrieves the draft buildable spaces for the user
 * @param {string} uid
 */
export async function getSpaceDrafts(uid) {
  const db = await initDB();
  const entry = await db.get(DRAFT_SPACES_STORE, uid);
  return entry ? entry.spaces : [];
}

/**
 * Clears the draft buildable spaces for the user (e.g., after successful save)
 * @param {string} uid
 */
export async function clearSpaceDrafts(uid) {
  const db = await initDB();
  return db.delete(DRAFT_SPACES_STORE, uid);
}

// ==========================================
//        FACILITY REPAIRS (Offline Queue)
// ==========================================

/**
 * Saves a facility repair assessment locally for offline sync
 * @param {Object} repairData - The repair payload
 */
export async function addRepairToLocal(repairData) {
  const db = await initDB();
  return db.add(REPAIRS_STORE, {
    ...repairData,
    timestamp: new Date().toISOString(),
    status: 'pending'
  });
}

/**
 * Retrieves all pending repairs from IndexedDB
 */
export async function getLocalRepairs() {
  const db = await initDB();
  return db.getAll(REPAIRS_STORE);
}

/**
 * Deletes a repair from IndexedDB after successful sync
 * @param {number} localId - The local_id key
 */
export async function deleteLocalRepair(localId) {
  const db = await initDB();
  return db.delete(REPAIRS_STORE, localId);
}

// ==========================================
//        UNIT 1 MODULAR DRAFTS (School Head)
// ==========================================

export async function saveUnit1Draft(iern, draftData) {
  const db = await initDB();
  return db.put(UNIT_1_DRAFT_STORE, { iern, data: draftData, timestamp: Date.now() });
}

export async function getUnit1Draft(iern) {
  const db = await initDB();
  const entry = await db.get(UNIT_1_DRAFT_STORE, iern);
  return entry ? entry.data : null;
}

export async function clearUnit1Draft(iern) {
  const db = await initDB();
  return db.delete(UNIT_1_DRAFT_STORE, iern);
}

// ==========================================
//        GENERIC UNIT DRAFTS (School Head)
// ==========================================

/**
 * Saves a unit draft to IndexedDB
 * @param {string|number} unitId 
 * @param {string|number} schoolId 
 * @param {Object} draft - { step, formData, ... }
 */
export async function saveUnitDraft(unitId, schoolId, draft) {
  const db = await initDB();
  const id = `unit_${unitId}_school_${schoolId}`;
  return db.put(UNIT_DRAFTS_STORE, { id, unitId, schoolId, draft, timestamp: Date.now() });
}

/**
 * Retrieves a unit draft from IndexedDB
 * @param {string|number} unitId 
 * @param {string|number} schoolId 
 */
export async function getUnitDraft(unitId, schoolId) {
  const db = await initDB();
  const id = `unit_${unitId}_school_${schoolId}`;
  const entry = await db.get(UNIT_DRAFTS_STORE, id);
  return entry ? entry.draft : null;
}

/**
 * Clears a unit draft from IndexedDB
 * @param {string|number} unitId 
 * @param {string|number} schoolId 
 */
export async function clearUnitDraft(unitId, schoolId) {
  const db = await initDB();
  const id = `unit_${unitId}_school_${schoolId}`;
  return db.delete(UNIT_DRAFTS_STORE, id);
}

// ==========================================
//        OFFLINE FILE STORAGE
// ==========================================

/**
 * Saves a binary file locally for offline access
 */
export async function saveOfflineFile(iern, file, docType) {
    const db = await initDB();
    return db.put(OFFLINE_FILES_STORE, {
        iern,
        file, // Stores the File/Blob object
        fileName: file.name,
        fileType: file.type,
        docType,
        timestamp: Date.now()
    });
}

/**
 * Retrieves latest offline file for a specific IERN
 */
export async function getOfflineFile(iern) {
    const db = await initDB();
    const all = await db.getAll(OFFLINE_FILES_STORE);
    return all.filter(f => f.iern === iern).sort((a,b) => b.timestamp - a.timestamp)[0];
}

/**
 * Deletes local offline file
 */
export async function deleteOfflineFile(id) {
    const db = await initDB();
    return db.delete(OFFLINE_FILES_STORE, id);
}

/**
 * Migrates all local drafts and outbox entries from one school ID to another.
 * Used during Identity Shift in Unit 1.
 */
export async function migrateUnitDrafts(oldSchoolId, newSchoolId) {
    const db = await initDB();
    const tx = db.transaction([UNIT_DRAFTS_STORE, MODULAR_OUTBOX_STORE], 'readwrite');
    
    // 1. Migrate Unit Drafts
    const draftsStore = tx.objectStore(UNIT_DRAFTS_STORE);
    const allDrafts = await draftsStore.getAll();
    for (const entry of allDrafts) {
        if (String(entry.schoolId) === String(oldSchoolId)) {
            // Create new entry
            const newId = `unit_${entry.unitId}_school_${newSchoolId}`;
            await draftsStore.put({
                ...entry,
                id: newId,
                schoolId: newSchoolId
            });
            // Delete old entry
            await draftsStore.delete(entry.id);
        }
    }

    // 2. Migrate Modular Outbox
    const outboxStore = tx.objectStore(MODULAR_OUTBOX_STORE);
    const allOutbox = await outboxStore.getAll();
    for (const entry of allOutbox) {
        if (String(entry.schoolId) === String(oldSchoolId)) {
            await outboxStore.put({
                ...entry,
                schoolId: newSchoolId,
                payload: {
                    ...entry.payload,
                    school_id: newSchoolId
                }
            });
        }
    }

    await tx.done;
    console.log(`✅ [DB] Successfully migrated local data from ${oldSchoolId} to ${newSchoolId}`);
}
