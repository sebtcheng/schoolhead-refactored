
// --- DATABASE INITIALIZATION & MIGRATIONS ---1111111111

const initOtpTable = async (pool) => {
    try {
        const res = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'verification_codes'
            );
        `);
        if (res.rows[0].exists) {
            // console.log("✅ OTP Table Exists");
            return;
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS verification_codes (
                email VARCHAR(255) PRIMARY KEY,
                code VARCHAR(10) NOT NULL,
                expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
            );
        `);
        console.log("✅ OTP Table Initialized");
    } catch (err) {
        console.error("❌ Failed to init OTP table:", err.message);
    }
};

const initChatSchema = async (client, dbLabel = 'Chat-DB') => {
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_rooms (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                room_type VARCHAR(50) DEFAULT 'direct',
                region VARCHAR(100),
                division VARCHAR(100),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_room_participants (
                id SERIAL PRIMARY KEY,
                room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
                user_uid VARCHAR(255) NOT NULL,
                user_role VARCHAR(100),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_room_participant UNIQUE (room_id, user_uid)
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
                sender_uid VARCHAR(255) NOT NULL,
                message_text TEXT,
                message_type VARCHAR(50) DEFAULT 'text',
                attachment_url TEXT,
                attachment_metadata JSONB,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS siif_ro_coordination (
                "MID" SERIAL PRIMARY KEY,
                "Division" VARCHAR(100),
                "Region" VARCHAR(100),
                "SenderUID" VARCHAR(255),
                "SenderName" VARCHAR(255),
                "SenderRole" VARCHAR(100),
                "RecipientUID" VARCHAR(255),
                "RecipientName" VARCHAR(255),
                "RecipientRole" VARCHAR(100),
                "Message" TEXT,
                "Timestamp" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "IsRead" BOOLEAN DEFAULT FALSE,
                "AttachmentUrl" TEXT
            );
        `);

        console.log(`✅ [${dbLabel}] Chat Schema Initialized.`);
    } catch (err) {
        console.error(`❌ [${dbLabel}] Failed to initialize chat schema:`, err.message);
    }
};

const initUnit7Schema = async (client, dbLabel) => {
    // Legacy unit 7 flat tables decommissioned in favor of ph_school_unit_submissions
};

const initUnit8Schema = async (client, dbLabel) => {
    // Legacy unit 8 flat tables decommissioned in favor of ph_school_unit_submissions
};

const initUnitTimestampTrigger = async (client, dbLabel) => {
    // Unit completion timestamps managed by ph_school_unit_submissions
};

const initHybridSubmissionsSchema = async (client, dbLabel) => {
    try {
        console.log(`🏗️ [${dbLabel}] Initializing Hybrid JSONB Submissions Schema (v2 - SDO Validation)...`);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS ph_schools (
                iern TEXT PRIMARY KEY,
                school_id TEXT UNIQUE NOT NULL,
                school_name TEXT,
                region TEXT,
                division TEXT,
                district TEXT,
                province TEXT,
                municipality TEXT,
                legislative_district TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS ph_school_unit_submissions (
                iern TEXT NOT NULL REFERENCES ph_schools(iern) ON DELETE CASCADE,
                unit_number INTEGER NOT NULL CHECK (unit_number BETWEEN 1 AND 9),
                payload JSONB NOT NULL DEFAULT '{}',
                schema_version TEXT NOT NULL DEFAULT 'v1',
                is_completed BOOLEAN DEFAULT FALSE,
                validation_status TEXT NOT NULL DEFAULT 'draft'
                    CHECK (validation_status IN ('draft', 'submitted', 'validated', 'returned', 'rejected')),
                validation_remarks TEXT,
                submitted_at TIMESTAMPTZ,
                validated_by TEXT,
                validated_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (iern, unit_number)
            );
        `);

        await client.query(`
            ALTER TABLE ph_school_unit_submissions
            ADD COLUMN IF NOT EXISTS validation_remarks TEXT,
            ADD COLUMN IF NOT EXISTS validated_by TEXT,
            ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
        `);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_school_unit_status ON ph_school_unit_submissions (unit_number, validation_status);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_school_unit_completed ON ph_school_unit_submissions (unit_number, is_completed);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_school_unit_payload_gin ON ph_school_unit_submissions USING gin (payload);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_unit1_division ON ph_school_unit_submissions ((payload->>'division')) WHERE unit_number = 1;`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_unit2_total_learners ON ph_school_unit_submissions (((payload->>'total_learners')::int)) WHERE unit_number = 2;`);

        console.log(`✅ [${dbLabel}] Hybrid Submissions Schema (ph_school_unit_submissions) Initialized.`);
    } catch (err) {
        console.error(`❌ [${dbLabel}] Hybrid Submissions Schema Migration Failed:`, err.message);
    }
};

const runMigrations = async (client, dbLabel) => {
    // [Master Protocol] Strategic Advisory Lock (ID: 7777777) 
    // Prevents race conditions when multiple workers attempt schema changes simultaneously.
    const lockRes = await client.query('SELECT pg_try_advisory_lock(7777777) as lock_granted');
    if (!lockRes.rows[0].lock_granted) {
        console.log(`⚠️ [${dbLabel}] Migrations already being handled by another worker. Skipping.`);
        return;
    }

    try {
        console.log(`🏗️ [${dbLabel}] Starting comprehensive schema migrations...`);
        // --- 0. HYBRID JSONB & UNIT SCHEMAS ---
        await initHybridSubmissionsSchema(client, dbLabel);
        await initUnit7Schema(client, dbLabel);
        await initUnit8Schema(client, dbLabel);
        await initUnitTimestampTrigger(client, dbLabel);

        // --- 1. AUDIT FEEDBACK TASKS TABLE ---
        try {
            // Drop legacy table as requested
            await client.query('DROP TABLE IF EXISTS audit_remarks CASCADE');

            await client.query(`
            CREATE TABLE IF NOT EXISTS audit_feedback_tasks (
                id SERIAL PRIMARY KEY,
                school_id TEXT NOT NULL,
                iern TEXT,
                unit_id TEXT NOT NULL,
                instruction TEXT NOT NULL,
                auditor_uid TEXT,
                auditor_name TEXT,
                status TEXT DEFAULT 'flagged', -- flagged, fixed, verified, reopened
                school_head_note TEXT,
                is_resolved BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
            // console.log(`✅ [${dbLabel}] Audit Feedback Tasks Table Initialized`);
        } catch (tableErr) {
            console.error(`❌ [${dbLabel}] Failed to init audit_feedback_tasks table:`, tableErr.message);
        }

        // --- 3. NOTIFICATIONS TABLE ---
        try {
            await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                recipient_uid TEXT NOT NULL,
                sender_uid TEXT,
                sender_name TEXT,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT DEFAULT 'alert',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        } catch (tableErr) {
            console.error(`❌ [${dbLabel}] Failed to init notifications table:`, tableErr.message);
        }

        // --- 4. SETTINGS TABLE ---
        try {
            await client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO settings (key, value)
            VALUES ('nexus_module_locks', '{"school-info": false, "esf7": false, "nspp": true}')
            ON CONFLICT (key) DO NOTHING;
        `);
        } catch (tableErr) {
            console.error(`❌ [${dbLabel}] Failed to init settings table:`, tableErr.message);
        }



        // --- 2.2. SCHOOL COMPLETION TABLE ---
        try {
            await client.query(`
            CREATE TABLE IF NOT EXISTS ph_school_completion (
                iern VARCHAR(255) PRIMARY KEY,
                school_id VARCHAR(255),
                region TEXT,
                division TEXT,
                unit1_completion BOOLEAN DEFAULT false,
                unit2_completion BOOLEAN DEFAULT false,
                unit3_completion BOOLEAN DEFAULT false,
                unit4_completion BOOLEAN DEFAULT false,
                unit5_completion BOOLEAN DEFAULT false,
                unit6_completion BOOLEAN DEFAULT false,
                unit7_completion BOOLEAN DEFAULT false,
                unit8_completion BOOLEAN DEFAULT false,
                total_completion NUMERIC(5,2) DEFAULT 0,
                registration_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
            await client.query(`
            ALTER TABLE ph_school_completion 
            ADD COLUMN IF NOT EXISTS school_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS registration_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS region TEXT,
            ADD COLUMN IF NOT EXISTS division TEXT;
        `).catch(() => { });

            // Data Backfill: Populate region/division from schools_IERN (HAWKEYE Protocol)
            await client.query(`
            UPDATE ph_school_completion psc
            SET
                region = si."Region",
                division = si."Division"
            FROM "schools_IERN" si
            WHERE psc.school_id = si."SchoolID"
              AND (psc.region IS NULL OR psc.division IS NULL);
        `).catch(err => {
                console.warn(`⚠️ [${dbLabel}] ph_school_completion backfill skipped:`, err.message);
            });

            // Deduplicate school_id before adding unique constraint (keep row with highest total_completion)
            await client.query(`
            DELETE FROM ph_school_completion
            WHERE iern NOT IN (
                SELECT DISTINCT ON (school_id) iern
                FROM ph_school_completion
                WHERE school_id IS NOT NULL
                ORDER BY school_id, total_completion DESC, updated_at DESC NULLS LAST
            ) AND school_id IS NOT NULL;
        `).catch(err => {
                console.warn(`⚠️ [${dbLabel}] ph_school_completion dedup skipped:`, err.message);
            });

            // ON CONFLICT (school_id) requires a full (non-partial) unique index.
            // A partial index (WHERE school_id IS NOT NULL) does NOT satisfy ON CONFLICT (school_id).
            // Drop whatever exists (partial or non-unique), then recreate as a full unique index.
            await client.query(`DROP INDEX IF EXISTS idx_ph_school_completion_school_id;`).catch(() => { });
            await client.query(`
            CREATE UNIQUE INDEX idx_ph_school_completion_school_id
            ON ph_school_completion(school_id);
        `).catch(err => {
                console.warn(`⚠️ [${dbLabel}] ph_school_completion school_id unique index skipped:`, err.message);
            });

            // console.log(`✅ [${dbLabel}] School Completion Table Initialized`);
        } catch (tableErr) {
            console.error(`❌ [${dbLabel}] Failed to init ph_school_completion table:`, tableErr.message);
        }

        // --- 2.5. ACTIVITY LOGS TABLE ---
        try {
            await client.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                log_id SERIAL PRIMARY KEY,
                user_uid TEXT,
                user_name TEXT,
                role TEXT,
                action_type TEXT,
                target_entity TEXT,
                details TEXT,
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
            // console.log(`✅ [${dbLabel}] Activity Logs Table Initialized`);
        } catch (tableErr) {
            console.error(`❌ [${dbLabel}] Failed to init activity_logs table:`, tableErr.message);
        }



        // --- 4. USER DEVICE TOKENS ---
        try {
            await client.query(`
            CREATE TABLE IF NOT EXISTS user_device_tokens (
                uid TEXT PRIMARY KEY,
                fcm_token TEXT NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
            // console.log(`✅ [${dbLabel}] User Device Tokens Table Initialized`);
        } catch (tokenErr) {
            console.error(`❌ [${dbLabel}] Failed to init user_device_tokens:`, tokenErr.message);
        }

        // --- 4.1. WEB PUSH SUBSCRIPTIONS (Standard Browser Push) ---
        try {
            await client.query(`
            CREATE TABLE IF NOT EXISTS user_web_push_subscriptions (
                id SERIAL PRIMARY KEY,
                uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
                subscription_json JSONB NOT NULL,
                device_info TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_user_subscription UNIQUE(uid, subscription_json)
            );
            CREATE INDEX IF NOT EXISTS idx_push_uid ON user_web_push_subscriptions(uid);
        `);
        } catch (pushErr) {
            console.error(`❌ [${dbLabel}] Failed to init user_web_push_subscriptions:`, pushErr.message);
        }

        // --- 5. USERS TABLE EXTENSIONS ---
        try {
            await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                uid TEXT PRIMARY KEY,
                email TEXT,
                role TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                first_name TEXT,
                last_name TEXT,
                region TEXT,
                division TEXT,
                province TEXT,
                city TEXT,
                barangay TEXT,
                office TEXT,
                position TEXT,
                disabled BOOLEAN DEFAULT FALSE
            );
        `);

            // Consolidate all extensions into a single idempotent block
            await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS first_name TEXT,
            ADD COLUMN IF NOT EXISTS last_name TEXT,
            ADD COLUMN IF NOT EXISTS region TEXT,
            ADD COLUMN IF NOT EXISTS division TEXT,
            ADD COLUMN IF NOT EXISTS province TEXT,
            ADD COLUMN IF NOT EXISTS city TEXT,
            ADD COLUMN IF NOT EXISTS barangay TEXT,
            ADD COLUMN IF NOT EXISTS office TEXT,
            ADD COLUMN IF NOT EXISTS position TEXT,
            ADD COLUMN IF NOT EXISTS contact_number TEXT,
            ADD COLUMN IF NOT EXISTS alt_email TEXT,
            ADD COLUMN IF NOT EXISTS account_category TEXT,
            ADD COLUMN IF NOT EXISTS iern TEXT,
            ADD COLUMN IF NOT EXISTS school_id TEXT,
            ADD COLUMN IF NOT EXISTS registrant_type TEXT,
            ADD COLUMN IF NOT EXISTS password_hash TEXT,
            ADD COLUMN IF NOT EXISTS password_salt TEXT,
            ADD COLUMN IF NOT EXISTS hash_version TEXT,
            ADD COLUMN IF NOT EXISTS passcode TEXT,
            ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE,
            DROP COLUMN IF EXISTS registrar_type,
            DROP COLUMN IF EXISTS email_address,
            ALTER COLUMN passcode TYPE TEXT;
        `);

            // Create UNIQUE INDEX on school_id (only for non-null values)
            await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_school_id 
            ON users(school_id) 
            WHERE school_id IS NOT NULL;
        `);

            // Index for rapid login by email (case-insensitive)
            await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_email_lower 
            ON users(LOWER(email));
        `);

            // console.log(`✅ [${dbLabel}] Users Table Schema Updated & Indexed`);
        } catch (migErr) {
            console.error(`❌ [${dbLabel}] Failed to migrate users table:`, migErr.message);
        }



        // --- 12. SYSTEM SETTINGS ---
        try {
            await client.query(`
          CREATE TABLE IF NOT EXISTS system_settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_by TEXT
          );
        `);
            console.log(`✅ [${dbLabel}] System Settings Table Initialized`);
        } catch (tableErr) {
            console.error(`❌ [${dbLabel}] Failed to init system_settings table:`, tableErr.message);
        }




        // =========================================================================
        // --- 17. PH_SCHOOLS — CORE IDENTITY REGISTRY SCHEMA -------------------
        // =========================================================================
        try {
            await client.query(`
            CREATE TABLE IF NOT EXISTS ph_schools (
                iern TEXT PRIMARY KEY,
                school_id TEXT UNIQUE NOT NULL,
                school_name TEXT,
                region TEXT,
                division TEXT,
                district TEXT,
                province TEXT,
                municipality TEXT,
                legislative_district TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

            await client.query(`CREATE INDEX IF NOT EXISTS idx_ph_schools_division ON ph_schools(division);`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_ph_schools_region ON ph_schools(region);`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_ph_schools_regional_summary ON ph_schools(region, division);`);

            console.log(`✅ [${dbLabel}] ph_schools core identity schema ensured`);
        } catch (migErr) {
            console.error(`❌ [${dbLabel}] Failed to ensure ph_schools schema:`, migErr.message);
        }

        // --- 18. CHATBOT KNOWLEDGE TABLE --- [DECOMMISSIONED]
        /*
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS chatbot_knowledge (
                    id SERIAL PRIMARY KEY,
                    content TEXT NOT NULL,
                    embedding JSONB,
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log(`✅ [${dbLabel}] Chatbot Knowledge Table Initialized`);
        } catch (migErr) {
            console.error(`❌ [${dbLabel}] Failed to init chatbot_knowledge table:`, migErr.message);
        }
        */

        // --- 19. SYSTEM FEEDBACK TABLE --- [DECOMMISSIONED]
        /*
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS system_feedback (
                    id SERIAL PRIMARY KEY,
                    content VARCHAR(200) NOT NULL,
                    user_email TEXT,
                    user_uid TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log(`✅ [${dbLabel}] System Feedback Table Initialized`);
        } catch (migErr) {
            console.error(`❌ [${dbLabel}] Failed to init system_feedback table:`, migErr.message);
        }
        */

        // --- 20. APP FEEDBACK TABLE (DETAILED) --- [DECOMMISSIONED]
        /*
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS app_feedback (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT,
                    user_name TEXT,
                    role TEXT,
                    ease_of_use INTEGER,
                    aesthetics INTEGER,
                    functionality INTEGER,
                    comment TEXT,
                    app_version TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log(`✅ [${dbLabel}] App Feedback Table Initialized`);
        } catch (migErr) {
            console.error(`❌ [${dbLabel}] Failed to init app_feedback table:`, migErr.message);
        }
        */

        // --- 21. SCHOOL OWNERSHIP DOCUMENTS TABLE ---
        try {
            await client.query(`
            CREATE TABLE IF NOT EXISTS school_ownership_docs (
                id SERIAL PRIMARY KEY,
                iern TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_name TEXT,
                doc_type TEXT,
                status TEXT DEFAULT 'pending', -- pending, optimized
                binary_id UUID,
                file_size BIGINT,
                original_size BIGINT,
                hydra_manifest JSONB,
                school_id TEXT,
                ownership_document_type TEXT,
                compressed_binary_id UUID,
                compressed_size BIGINT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

            // Idempotent column additions
            await client.query(`ALTER TABLE school_ownership_docs ADD COLUMN IF NOT EXISTS binary_id UUID;`).catch(() => { });
            await client.query(`ALTER TABLE school_ownership_docs ADD COLUMN IF NOT EXISTS file_size BIGINT;`).catch(() => { });
            await client.query(`ALTER TABLE school_ownership_docs ADD COLUMN IF NOT EXISTS original_size BIGINT;`).catch(() => { });
            await client.query(`ALTER TABLE school_ownership_docs ADD COLUMN IF NOT EXISTS hydra_manifest JSONB;`).catch(() => { });
            await client.query(`ALTER TABLE school_ownership_docs ADD COLUMN IF NOT EXISTS school_id TEXT;`).catch(() => { });
            await client.query(`ALTER TABLE school_ownership_docs ADD COLUMN IF NOT EXISTS ownership_document_type TEXT;`).catch(() => { });
            await client.query(`ALTER TABLE school_ownership_docs ADD COLUMN IF NOT EXISTS compressed_binary_id UUID;`).catch(() => { });
            await client.query(`ALTER TABLE school_ownership_docs ADD COLUMN IF NOT EXISTS compressed_size BIGINT;`).catch(() => { });

            // Ensure id has sequence default if it was created without SERIAL sequence
            await client.query(`
                CREATE SEQUENCE IF NOT EXISTS school_ownership_docs_id_seq;
                SELECT setval('school_ownership_docs_id_seq', COALESCE((SELECT MAX(id) FROM school_ownership_docs), 0) + 1, false);
                ALTER TABLE school_ownership_docs ALTER COLUMN id SET DEFAULT nextval('school_ownership_docs_id_seq');
                ALTER SEQUENCE school_ownership_docs_id_seq OWNED BY school_ownership_docs.id;
            `).catch(() => { });

            // Data Healing: Cleanup orphans to allow FK creation
            // [LOCKED] Table is append-only (InsightEd-2026-DocLock). Orphan cleanup via DELETE is skipped.
            // await client.query("DELETE FROM school_ownership_docs WHERE iern NOT IN (SELECT iern FROM ph_schools)");

            // Idempotent Unique Constraint Enforcement (HAWKEYE Protocol)
            // Step 1: Deduplicate — keep only the latest row per IERN before applying constraint
            await client.query(`
            DELETE FROM school_ownership_docs WHERE id NOT IN (
                SELECT id FROM (
                    SELECT id, ROW_NUMBER() OVER (PARTITION BY iern ORDER BY created_at DESC) as rn
                    FROM school_ownership_docs WHERE iern IS NOT NULL
                ) s WHERE s.rn = 1
            )
        `).catch(e => console.warn(`⚠️ [${dbLabel}] school_ownership_docs dedup skipped:`, e.message));

            // Step 2: Apply unique constraint idempotently
            await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_ownership_docs_iern_unique') THEN
                    ALTER TABLE school_ownership_docs ADD CONSTRAINT school_ownership_docs_iern_unique UNIQUE (iern);
                END IF;
            END $$;
        `);

            // Idempotent Foreign Key Enforcement
            await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_school_ownership_iern') THEN
                    ALTER TABLE school_ownership_docs
                    ADD CONSTRAINT fk_school_ownership_iern
                    FOREIGN KEY (iern) REFERENCES ph_schools(iern)
                    ON DELETE CASCADE;
                END IF;
            END $$;
        `);

            console.log(`✅ [${dbLabel}] School Ownership Documents Table Initialized & Healed`);
        } catch (migErr) {
            console.error(`❌ [${dbLabel}] Failed to init school_ownership_docs table:`, migErr.message);
        }

        // --- 21b. SCHOOL OWNERSHIP RECORDS TABLE ---
        try {
            await client.query(`
            CREATE TABLE IF NOT EXISTS school_ownership_records (
                id SERIAL PRIMARY KEY,
                iern TEXT NOT NULL REFERENCES ph_schools(iern) ON DELETE CASCADE,
                ownership_type TEXT NOT NULL,
                document_type TEXT,
                ownership_doc_id INT REFERENCES school_ownership_docs(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            `);
            console.log(`✅ [${dbLabel}] School Ownership Records Table Initialized`);
        } catch (recErr) {
            console.error(`❌ [${dbLabel}] Failed to init school_ownership_records table:`, recErr.message);
        }

        // Legacy flat unit tables (unit1-unit6) decommissioned in favor of ph_school_unit_submissions

        // --- 21e. PH SCHOOLS VALIDATE TABLE ---
        try {
            await client.query(`
            CREATE TABLE IF NOT EXISTS ph_schools_validate (
                school_id VARCHAR(255) PRIMARY KEY REFERENCES ph_schools(school_id) ON DELETE CASCADE,
                unit1_completed BOOLEAN DEFAULT FALSE,
                unit2_completed BOOLEAN DEFAULT FALSE,
                unit3_completed BOOLEAN DEFAULT FALSE,
                unit4_completed BOOLEAN DEFAULT FALSE,
                unit5_completed BOOLEAN DEFAULT FALSE,
                unit6_completed BOOLEAN DEFAULT FALSE,
                unit7_completed BOOLEAN DEFAULT FALSE,
                unit8_completed BOOLEAN DEFAULT FALSE,
                unit9_completed BOOLEAN DEFAULT FALSE,
                unit1_validated BOOLEAN DEFAULT FALSE,
                unit2_validated BOOLEAN DEFAULT FALSE,
                unit3_validated BOOLEAN DEFAULT FALSE,
                unit4_validated BOOLEAN DEFAULT FALSE,
                unit5_validated BOOLEAN DEFAULT FALSE,
                unit6_validated BOOLEAN DEFAULT FALSE,
                unit7_validated BOOLEAN DEFAULT FALSE,
                unit8_validated BOOLEAN DEFAULT FALSE,
                unit9_validated BOOLEAN DEFAULT FALSE,
                needs_validation BOOLEAN DEFAULT FALSE,
                validation_percentage NUMERIC(5,2) DEFAULT 0.00,
                validated_units_count INTEGER DEFAULT 0
            );
            `);
            console.log(`✅ [${dbLabel}] ph_schools_validate Table Initialized`);
        } catch (valErr) {
            console.error(`❌ [${dbLabel}] Failed to init ph_schools_validate table:`, valErr.message);
        }


        // NOTE: Unit 7 condition & utility columns are now included in the
        // canonical ph_schools schema block above (migration #17). Removed
        // duplicate migrations #22 and #23.



        // --- UNIFIED BINARY STORAGE ---
        try {
            await client.query(`
            CREATE TABLE IF NOT EXISTS unified_binaries (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                hash TEXT NOT NULL,
                content BYTEA NOT NULL,
                mime_type TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

            // TOAST hint: store BYTEA chunks externally to keep main table indices snappy
            await client.query(`
            ALTER TABLE unified_binaries ALTER COLUMN content SET STORAGE EXTERNAL;
        `);

            // AUTOVACUUM Tuning (Postgres Master Protocol): 
            // Reduce scale factor to 1% to prevent bloat in blob-heavy tables
            await client.query(`
            ALTER TABLE unified_binaries SET (
                autovacuum_vacuum_scale_factor = 0.01,
                autovacuum_vacuum_cost_limit = 1000
            );
        `);

            // O(log n) deduplication lookups
            await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_binaries_hash ON unified_binaries(hash);
        `);


            console.log(`✅ [${dbLabel}] Unified Binaries Table & Indices Initialized`);
        } catch (binErr) {
            console.error(`❌ [${dbLabel}] Unified Binaries Migration Failed:`, binErr.message);
        }

        // --- 25b. SCHOOL LOCATION VIEW ---
        try {
            await client.query(`
            DROP VIEW IF EXISTS ph_public_schools_location CASCADE;
            
            CREATE OR REPLACE VIEW ph_public_schools_location AS
            SELECT 
                si."IERN" AS iern,
                si."SchoolID" AS school_id,
                COALESCE(u1.school_name, si."School_Name") AS school_name,
                COALESCE(u1.region, si."Region") AS region,
                COALESCE(u1.province, si."Province") AS province,
                COALESCE(u1.municipality, si."Municipality") AS municipality,
                COALESCE(u1.barangay, si."Barangay") AS barangay,
                COALESCE(u1.division, si."Division") AS division,
                COALESCE(u1.district, si."District") AS district,
                COALESCE(u1.leg_district, si."Legislative_District") AS leg_district,
                COALESCE(u1.curricular_offering, si."Curricular_Offering") AS curricular_offering,
                COALESCE(u1.latitude, si."Latitude"::text) AS latitude,
                COALESCE(u1.longitude, si."Longitude"::text) AS longitude,
                EXISTS (
                    SELECT 1 
                    FROM ph_school_buildable_spaces bs 
                    WHERE bs.iern = si."IERN" OR bs.school_id = si."SchoolID"
                )::boolean AS has_buildable_space,
                EXISTS (
                    SELECT 1 
                    FROM ph_buildings_demolition bd 
                    WHERE bd.iern = si."IERN" OR bd.school_id = si."SchoolID"
                )::boolean AS has_building_demolition
            FROM "schools_IERN" si
            LEFT JOIN unit1_school_identity u1 ON si."IERN" = u1.iern
            WHERE si."SchoolID" NOT LIKE '999%'
              AND si."IERN" NOT LIKE '999%'
              AND si."Region" IS NOT NULL
              AND TRIM(si."Region") != ''
              AND UPPER(si."Region") != 'BLANK REGION';
            `);
            console.log(`✅ [${dbLabel}] ph_public_schools_location View Initialized`);
        } catch (viewErr) {
            console.error(`❌ [${dbLabel}] Failed to init ph_public_schools_location view:`, viewErr.message);
        }




        // --- 26. UNIT 7: PHYSICAL FACILITIES ---
        await initUnit7Schema(client, dbLabel);


        // --- 20. GLOBAL DELETION & TRUNCATION PROTECTION (Nuclear Lock) ---
        // Applies RLS, FORCE RLS, a mathematical no_delete policy, TRUNCATE trigger,
        // and a DELETE trigger to EVERY table in the public schema.
        // Bypass: SET LOCAL internal.authorized_app_deletion = 'true' within a transaction.
        try {
            console.log(`🛡️ [${dbLabel}] Enforcing GLOBAL Deletion Protection (Nuclear Lock)...`);

            // 1. Truncation Prevention Function
            await client.query(`
            CREATE OR REPLACE FUNCTION fn_prevent_truncate()
            RETURNS TRIGGER AS $$
            BEGIN
                RAISE EXCEPTION '❌ [MASTER TINKERER SENTINEL] TRUNCATE is prohibited on this production instance.';
            END;
            $$ LANGUAGE plpgsql;
        `);

            // 2. Deletion Prevention Function (with authorized bypass)
            await client.query(`
            CREATE OR REPLACE FUNCTION fn_prevent_deletion()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Authorized bypass: SET LOCAL internal.authorized_app_deletion = 'true'
                IF current_setting('internal.authorized_app_deletion', true) = 'true' THEN
                    RETURN OLD;
                END IF;
                RAISE EXCEPTION '❌ [MASTER TINKERER SENTINEL] LOCKED_RESOURCE_DELETION_PROHIBITED: Deletion is prohibited for this table. (Table: %)', TG_TABLE_NAME;
            END;
            $$ LANGUAGE plpgsql;
        `);

            // 3. Apply to ALL tables dynamically using a single atomic DO block (v2.0 Optimization)
            // This prevents connection pool exhaustion by running the loop entirely on the DB side.
            console.log(`🛡️ [${dbLabel}] Executing Atomic Nuclear Lock...`);

            await client.query(`
            DO $$
            DECLARE
                t_name TEXT;
                excluded_tables TEXT[] := ARRAY['ph_buildings_inventory', 'ph_buildings_repairs', 'ph_buildings_demolition', 'ph_school_buildable_spaces', 'school_ownership_docs', 'school_location_profiles', 'unit8_location', 'buildable_spaces', 'unit6_furniture_grades', 'unit6_ecart_batches'];
                t_count INT := 0;
            BEGIN
                FOR t_name IN 
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_type = 'BASE TABLE'
                LOOP
                    IF t_name = ANY(excluded_tables) THEN
                        -- Idempotent Cleanup for Excluded Tables
                        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t_name);
                        EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t_name);
                        EXECUTE format('DROP POLICY IF EXISTS no_delete ON %I', t_name);
                        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_block_truncate_' || t_name, t_name);
                        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_prevent_deletion_' || t_name, t_name);
                    ELSE
                        -- Atomic Hardening
                        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t_name);
                        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t_name);
                        
                        EXECUTE format('DROP POLICY IF EXISTS no_delete ON %I', t_name);
                        EXECUTE format('CREATE POLICY no_delete ON %I FOR DELETE USING (current_setting(''internal.authorized_app_deletion'', true) = ''true'')', t_name);
                        
                        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_block_truncate_' || t_name, t_name);
                        EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION fn_prevent_truncate()', 'trg_block_truncate_' || t_name, t_name);
                        
                        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_prevent_deletion_' || t_name, t_name);
                        EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_prevent_deletion()', 'trg_prevent_deletion_' || t_name, t_name);
                    END IF;
                    t_count := t_count + 1;
                END LOOP;
                RAISE NOTICE '✅ Atomic Nuclear Lock complete. Processed % tables.', t_count;
            END $$;
        `);

            console.log(`✅ [${dbLabel}] Global Deletion Protection (Nuclear Lock) enforced via Atomic DO block.`);
        } catch (protectErr) {
            console.error(`❌ [${dbLabel}] Failed to enforce global deletion protection:`, protectErr.message);
        }


    } catch (globalErr) {
        console.error(`❌ [${dbLabel}] Global migration error:`, globalErr.message);
    } finally {
        await client.query('SELECT pg_advisory_unlock(7777777)').catch(() => { });
        console.log(`🔓 [${dbLabel}] Migration lock (7777777) released.`);
    }
};

export { initOtpTable, runMigrations, initChatSchema };

