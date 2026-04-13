
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

const initUnit7Schema = async (client, dbLabel) => {
    try {
        // 1. Ph Schools Extensions (Unit 7 Flags)
        // Note: ph_schools might be a view or a table; we ensure the underlying completion tracking works.
        await client.query(`
            ALTER TABLE ph_schools 
            ADD COLUMN IF NOT EXISTS unit7 BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS unit7_completed BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS unit7_updated_at TIMESTAMP;
        `).catch(() => {});

        // 2. Repairs Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS ph_buildings_repairs (
                id SERIAL PRIMARY KEY,
                school_id VARCHAR(255),
                iern VARCHAR(255),
                building_name TEXT,
                room_name TEXT,
                item_name TEXT,
                oms TEXT,
                condition TEXT,
                damage_ratio INTEGER DEFAULT 0,
                recommended_action TEXT,
                demo_justification TEXT,
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 3. Demolition Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS ph_buildings_demolition (
                id SERIAL PRIMARY KEY,
                school_id VARCHAR(255),
                iern VARCHAR(255),
                building_name TEXT,
                room_name TEXT,
                age BOOLEAN DEFAULT FALSE,
                safety BOOLEAN DEFAULT FALSE,
                calamity BOOLEAN DEFAULT FALSE,
                upgrade BOOLEAN DEFAULT FALSE,
                less_than_7x9 INTEGER DEFAULT 0,
                "7x9" INTEGER DEFAULT 0,
                above_7x9 INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Building Inventory Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS ph_buildings_inventory (
                id SERIAL PRIMARY KEY,
                school_id VARCHAR(255),
                iern VARCHAR(255),
                building_name TEXT,
                room_name TEXT,
                category TEXT,
                storey INTEGER DEFAULT 1,
                classroom INTEGER DEFAULT 1,
                year_completed TEXT,
                remarks TEXT,
                less_than_7x9 INTEGER DEFAULT 0,
                "7x9" INTEGER DEFAULT 0,
                above_7x9 INTEGER DEFAULT 0,
                grade_level TEXT,
                advisory_teacher TEXT,
                status TEXT,
                is_in_use BOOLEAN DEFAULT TRUE,
                seats TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // console.log(`✅ [${dbLabel}] Unit 7 Physical Facilities Schema Hardened`);
    } catch (err) {
        console.error(`❌ [${dbLabel}] Unit 7 Schema Migration Failed:`, err.message);
    }
};

const initUnit8Schema = async (client, dbLabel) => {
    try {
        console.log(`🏗️ [${dbLabel}] Hardening Unit 8 (School Terrain) Schema...`);
        
        // 1. Unified Advisory Lock (Unit 8 ID: 8888)
        const lockRes = await client.query('SELECT pg_try_advisory_lock(8888)');
        if (!lockRes.rows[0].pg_try_advisory_lock) {
            console.log(`⚠️ [${dbLabel}] Unit 8 migration already being handled by another worker.`);
            return;
        }

        try {
            // 2. Primary Table Initialization
            await client.query(`
                CREATE TABLE IF NOT EXISTS school_location_profiles (
                    school_id TEXT PRIMARY KEY,
                    iern TEXT,
                    transportation_modes JSONB DEFAULT '[]',
                    road_paved_pct NUMERIC,
                    road_unpaved_pct NUMERIC,
                    road_lighting_pct NUMERIC,
                    public_transpo_availability INTEGER,
                    water_proximity JSONB DEFAULT '[]',
                    near_cliff_ravine BOOLEAN DEFAULT FALSE,
                    road_cliff_pct NUMERIC,
                    near_water BOOLEAN DEFAULT FALSE,
                    natural_calamities JSONB DEFAULT '[]',
                    hazards_experienced JSONB DEFAULT '[]',
                    has_insurgency_threats BOOLEAN DEFAULT FALSE,
                    insurgency_threats_6mo INTEGER DEFAULT 0,
                    road_passable_public_transpo_pct NUMERIC,
                    river_crossing_on_foot BOOLEAN DEFAULT FALSE,
                    river_crossing_count INTEGER DEFAULT 0,
                    emergency_response_mins NUMERIC DEFAULT 0,
                    proximity_hospital_km NUMERIC DEFAULT 0,
                    proximity_brgy_hall_mins NUMERIC DEFAULT 0,
                    proximity_brgy_hall_km NUMERIC DEFAULT 0,
                    proximity_muni_hall_mins NUMERIC DEFAULT 0,
                    proximity_muni_hall_km NUMERIC DEFAULT 0,
                    proximity_sdo_mins NUMERIC DEFAULT 0,
                    proximity_sdo_km NUMERIC DEFAULT 0,
                    proximity_clinic_mins NUMERIC DEFAULT 0,
                    proximity_clinic_km NUMERIC DEFAULT 0,
                    proximity_terminal_mins NUMERIC DEFAULT 0,
                    proximity_terminal_km NUMERIC DEFAULT 0,
                    proximity_highway_mins NUMERIC DEFAULT 0,
                    proximity_highway_km NUMERIC DEFAULT 0,
                    cellular_coverage TEXT,
                    weather_isolation BOOLEAN DEFAULT FALSE,
                    anthropogenic_threats JSONB DEFAULT '[]',
                    risk_index TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // 3. JSONB Alignment (Zero-Downtime Conversion)
            const jsonbCols = ['transportation_modes', 'hazards_experienced', 'water_proximity', 'natural_calamities', 'anthropogenic_threats'];
            for (const col of jsonbCols) {
                await client.query(`
                    DO $$ 
                    BEGIN 
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_location_profiles' AND column_name = '${col}' AND data_type != 'jsonb') THEN
                            ALTER TABLE school_location_profiles ALTER COLUMN ${col} TYPE JSONB USING ${col}::JSONB;
                        END IF;
                    END $$;
                `);
            }

            // 4. Decimal Support for Time Fields (Migration from INTEGER to NUMERIC)
            const minsCols = [
                'emergency_response_mins', 'proximity_brgy_hall_mins', 'proximity_muni_hall_mins',
                'proximity_sdo_mins', 'proximity_clinic_mins', 'proximity_terminal_mins', 'proximity_highway_mins'
            ];
            for (const col of minsCols) {
                await client.query(`
                    DO $$ 
                    BEGIN 
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_location_profiles' AND column_name = '${col}' AND data_type = 'integer') THEN
                            ALTER TABLE school_location_profiles ALTER COLUMN ${col} TYPE NUMERIC USING ${col}::NUMERIC;
                        END IF;
                    END $$;
                `);
            }

            console.log(`✅ [${dbLabel}] Unit 8 Schema is aligned and locked.`);
        } finally {
            await client.query('SELECT pg_advisory_unlock(8888)');
        }
    } catch (err) {
        console.error(`❌ [${dbLabel}] Unit 8 Schema Migration Failed:`, err.message);
    }
};

const runMigrations = async (client, dbLabel) => {
    // --- 0. UNIT SCHEMAS ---
    await initUnit7Schema(client, dbLabel);
    await initUnit8Schema(client, dbLabel);

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

    // --- 2. NOTIFICATIONS TABLE ---
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
        // console.log(`✅ [${dbLabel}] Notifications Table Initialized`);
    } catch (tableErr) {
        console.error(`❌ [${dbLabel}] Failed to init notifications table:`, tableErr.message);
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
        `).catch(() => {});

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

    // --- 3. SCHOOL PROFILES EXTENSIONS ---
    try {
        // Add Basic Extensions, Resources, Site & Utils
        await client.query(`
            ALTER TABLE school_profiles 
            ADD COLUMN IF NOT EXISTS email TEXT,
            ADD COLUMN IF NOT EXISTS submitted_by TEXT,
            ADD COLUMN IF NOT EXISTS curricular_offering TEXT,
            ADD COLUMN IF NOT EXISTS res_toilets_common INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS sha_category TEXT,
            ADD COLUMN IF NOT EXISTS res_faucets INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS res_ownership_type TEXT,
            ADD COLUMN IF NOT EXISTS res_electricity_source TEXT,
            ADD COLUMN IF NOT EXISTS res_buildable_space TEXT,
            ADD COLUMN IF NOT EXISTS res_water_source TEXT,
            ADD COLUMN IF NOT EXISTS res_internet_type TEXT;
        `);
        // console.log(`✅ [${dbLabel}] School Profiles Schema Updated (Basic Extensions)`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to migrate school_profiles basic:`, migErr.message);
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

    // --- 6. COMPREHENSIVE SCHOOL PROFILE COLUMNS (Detailed) ---
    try {
        await client.query(`
        ALTER TABLE school_profiles 
        -- Toilets & Labs
        ADD COLUMN IF NOT EXISTS res_toilets_pwd INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_sci_labs INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_com_labs INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_tvl_workshops INTEGER DEFAULT 0,

        -- Seats Analysis
        ADD COLUMN IF NOT EXISTS seats_kinder INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_2 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_3 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_4 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_6 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_7 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_8 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_9 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_10 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS seats_grade_12 INTEGER DEFAULT 0,

        -- Organized Classes (Counters)
        ADD COLUMN IF NOT EXISTS classes_kinder INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_2 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_3 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_4 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_6 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_7 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_8 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_9 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_10 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS classes_grade_12 INTEGER DEFAULT 0,

        -- Class Size Analysis (CRITICAL FOR ORGANIZED CLASSES DUAL-WRITE)
        ADD COLUMN IF NOT EXISTS cnt_less_kinder INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_kinder INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_kinder INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g2 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g2 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g2 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g3 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g3 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g3 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g4 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g4 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g4 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g6 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g6 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g6 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g7 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g7 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g7 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g8 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g8 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g8 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g9 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g9 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g9 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g10 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g10 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g10 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_less_g12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_within_g12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cnt_above_g12 INTEGER DEFAULT 0,

        -- Equipment Inventory
        ADD COLUMN IF NOT EXISTS res_ecart_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_ecart_nonfunc INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_laptop_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_laptop_nonfunc INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_tv_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_tv_nonfunc INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_printer_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_printer_nonfunc INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_desk_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_desk_nonfunc INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_armchair_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_armchair_nonfunc INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_toilet_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_toilet_nonfunc INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_handwash_func INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS res_handwash_nonfunc INTEGER DEFAULT 0;
      `);
        console.log(`✅ [${dbLabel}] Detailed School Analysis & Inventory Columns Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to migrate detailed columns:`, migErr.message);
    }

    // --- 7. TEACHER SPECIALIZATION ---
    try {
        await client.query(`
        ALTER TABLE school_profiles 
        ADD COLUMN IF NOT EXISTS spec_english_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_english_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_filipino_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_filipino_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_math_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_math_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_science_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_science_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_ap_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_ap_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_mapeh_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_mapeh_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_esp_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_esp_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_tle_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_tle_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_guidance INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_librarian INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_ict_coord INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_drrm_coord INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_general_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_general_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_ece_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_ece_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_bio_sci_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_bio_sci_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_phys_sci_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_phys_sci_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_agri_fishery_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_agri_fishery_teaching INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_others_major INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS spec_others_teaching INTEGER DEFAULT 0;
      `);
        console.log(`✅ [${dbLabel}] Teacher Specialization Columns Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to migrate specialization columns:`, migErr.message);
    }

    // --- 8. ENGINEER FORM SCHEMA ---
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS engineer_form (
                project_id SERIAL PRIMARY KEY,
                school_name TEXT,
                project_name TEXT,
                school_id TEXT,
                region TEXT,
                division TEXT,
                status TEXT,
                accomplishment_percentage INTEGER,
                status_as_of TIMESTAMPTZ,
                target_completion_date TIMESTAMPTZ,
                actual_completion_date TIMESTAMPTZ,
                notice_to_proceed TIMESTAMPTZ,
                contractor_name TEXT,
                approved_budget_for_contract NUMERIC,
                contract_amount NUMERIC,
                batch_of_funds TEXT,
                other_remarks TEXT,
                engineer_id TEXT,
                validated_by TEXT,
                funding_year INTEGER,
                funding_year_justification TEXT,
                is_donated BOOLEAN DEFAULT FALSE
            );
        `);
        await client.query(`
            ALTER TABLE engineer_form 
            ADD COLUMN IF NOT EXISTS ipc TEXT,
            ADD COLUMN IF NOT EXISTS status_of_construction_phase TEXT;
        `);

        // Synchronize status -> status_of_construction_phase if necessary
        await client.query(`
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='engineer_form' AND column_name='status') AND 
                   NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='engineer_form' AND column_name='status_of_construction_phase') THEN
                    ALTER TABLE engineer_form RENAME COLUMN status TO status_of_construction_phase;
                END IF;
            END $$;
        `);

        await client.query(`
            ALTER TABLE engineer_form
            -- 1. Identity & Location Extensions
            ADD COLUMN IF NOT EXISTS engineer_name TEXT,
            ADD COLUMN IF NOT EXISTS latitude TEXT,
            ADD COLUMN IF NOT EXISTS longitude TEXT,
            ADD COLUMN IF NOT EXISTS province TEXT,
            ADD COLUMN IF NOT EXISTS city TEXT,
            ADD COLUMN IF NOT EXISTS municipality TEXT,

            -- 2. Project Details Extensions
            ADD COLUMN IF NOT EXISTS construction_start_date TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS project_category TEXT,
            ADD COLUMN IF NOT EXISTS scope_of_work TEXT,
            ADD COLUMN IF NOT EXISTS number_of_classrooms INTEGER,
            ADD COLUMN IF NOT EXISTS number_of_sites INTEGER,
            ADD COLUMN IF NOT EXISTS number_of_storeys INTEGER,
            ADD COLUMN IF NOT EXISTS no_of_units INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS funds_utilized NUMERIC(20, 2),
            ADD COLUMN IF NOT EXISTS savings NUMERIC(20, 2),
            ADD COLUMN IF NOT EXISTS actions TEXT,

            -- 3. Procurement & Engineering details
            ADD COLUMN IF NOT EXISTS procurement_status TEXT,
            ADD COLUMN IF NOT EXISTS status_design_phase TEXT,
            ADD COLUMN IF NOT EXISTS contract_id TEXT,
            ADD COLUMN IF NOT EXISTS date_notice_of_award TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS issuance_of_invitation_to_bid TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS pre_bid_conference TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS opening_of_technical_proposal TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS opening_of_financial_proposal TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS request_for_quotation TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS negotiation TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS opening_of_quotation TIMESTAMPTZ,

            -- 4. Tracking & Delays
            ADD COLUMN IF NOT EXISTS funding_year INTEGER,
            ADD COLUMN IF NOT EXISTS funding_year_justification TEXT,
            ADD COLUMN IF NOT EXISTS delay_reason TEXT,
            ADD COLUMN IF NOT EXISTS revised_target_completion_date TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS time_lapsed_days INTEGER,
            ADD COLUMN IF NOT EXISTS time_lapsed_percentage TEXT,

            -- 5. Ownership & Assignment
            ADD COLUMN IF NOT EXISTS is_donated BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS program_type TEXT,
            ADD COLUMN IF NOT EXISTS uploader_type TEXT,
            ADD COLUMN IF NOT EXISTS mode_of_project TEXT,
            ADD COLUMN IF NOT EXISTS assigned_engineer_id TEXT,
            ADD COLUMN IF NOT EXISTS assigned_engineer_name TEXT,
            ADD COLUMN IF NOT EXISTS implementing_agency TEXT,
            ADD COLUMN IF NOT EXISTS implementing_agency_specific TEXT,
            ADD COLUMN IF NOT EXISTS uploader_id_moa_rta TEXT,

            -- 6. Document Blobs (The ones that caused the error)
            ADD COLUMN IF NOT EXISTS pow_pdf TEXT,
            ADD COLUMN IF NOT EXISTS dupa_pdf TEXT,
            ADD COLUMN IF NOT EXISTS contract_pdf TEXT,
            DROP CONSTRAINT IF EXISTS engineer_form_ipc_key;
        `);
        console.log(`✅ [${dbLabel}] Multi-Column alignment for engineer_form completed`);

        // --- 8b. ENGINEER IMAGE EXTENSIONS ---
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS engineer_image (
                    id SERIAL PRIMARY KEY,
                    project_id INTEGER REFERENCES engineer_form(project_id),
                    image_data TEXT,
                    uploaded_by TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            `);
            await client.query(`
                ALTER TABLE engineer_image 
                ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Internal',
                ADD COLUMN IF NOT EXISTS file_size BIGINT;
            `);
            console.log(`✅ [${dbLabel}] Engineer Image Schema Updated`);
        } catch (imgErr) {
            console.error(`❌ [${dbLabel}] Failed to migrate engineer_image:`, imgErr.message);
        }
        // --- 8d. ENGINEER DOCUMENTS TABLE ---
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS engineer_documents (
                    doc_id SERIAL PRIMARY KEY,
                    project_id INTEGER REFERENCES engineer_form(project_id),
                    ipc TEXT,
                    pow_pdf TEXT,
                    dupa_pdf TEXT,
                    contract_pdf TEXT,
                    moa_pdf TEXT,
                    rta_pdf TEXT,
                    uploader_id TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            `);
            // Ensure ipc column exists for older installs
            await client.query(`
                ALTER TABLE engineer_documents
                ADD COLUMN IF NOT EXISTS ipc TEXT,
                ADD COLUMN IF NOT EXISTS pow_pdf TEXT,
                ADD COLUMN IF NOT EXISTS dupa_pdf TEXT,
                ADD COLUMN IF NOT EXISTS contract_pdf TEXT,
                ADD COLUMN IF NOT EXISTS pow_filename TEXT,
                ADD COLUMN IF NOT EXISTS dupa_filename TEXT,
                ADD COLUMN IF NOT EXISTS contract_filename TEXT,
                ADD COLUMN IF NOT EXISTS moa_pdf TEXT,
                ADD COLUMN IF NOT EXISTS rta_pdf TEXT,
                ADD COLUMN IF NOT EXISTS uploader_id TEXT,
                ADD COLUMN IF NOT EXISTS binary_id UUID,
                ADD COLUMN IF NOT EXISTS pow_size BIGINT,
                ADD COLUMN IF NOT EXISTS dupa_size BIGINT,
                ADD COLUMN IF NOT EXISTS contract_size BIGINT,
                ADD COLUMN IF NOT EXISTS moa_size BIGINT,
                ADD COLUMN IF NOT EXISTS rta_size BIGINT,
                ADD COLUMN IF NOT EXISTS pow_original_size BIGINT,
                ADD COLUMN IF NOT EXISTS dupa_original_size BIGINT,
                ADD COLUMN IF NOT EXISTS contract_original_size BIGINT,
                ADD COLUMN IF NOT EXISTS moa_original_size BIGINT,
                ADD COLUMN IF NOT EXISTS rta_original_size BIGINT,
                ADD COLUMN IF NOT EXISTS hydra_manifest JSONB;
            `);
            console.log(`✅ [${dbLabel}] Engineer Documents Table Ready`);
        } catch (docsErr) {
            console.error(`❌ [${dbLabel}] Failed to migrate engineer_documents:`, docsErr.message);
        }

        // --- 8c. ENGINEER FORM REFACTOR ---
        try {
            // Rename project_allocation if it exists
            await client.query(`
                DO $$ 
                BEGIN 
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='engineer_form' AND column_name='project_allocation') THEN
                        ALTER TABLE engineer_form RENAME COLUMN project_allocation TO approved_budget_for_contract;
                    END IF;
                END $$;
            `);
            // Add contract_amount if it doesn't exist
            await client.query(`ALTER TABLE engineer_form ADD COLUMN IF NOT EXISTS contract_amount NUMERIC;`);
            console.log(`✅ [${dbLabel}] Engineer Form Column Refactor Completed`);
        } catch (refactorErr) {
            console.error(`❌ [${dbLabel}] Failed to refactor engineer_form columns:`, refactorErr.message);
        }

        console.log(`✅ [${dbLabel}] Engineer Form Schema Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to migrate engineer_form:`, migErr.message);
    }

    // --- 9. ARAL & TEACHING EXPERIENCE ---
    try {
        await client.query(`
        ALTER TABLE school_profiles 
        -- ARAL (Grades 1-6)
        ADD COLUMN IF NOT EXISTS aral_math_g1 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_read_g1 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_sci_g1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS aral_math_g2 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_read_g2 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_sci_g2 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS aral_math_g3 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_read_g3 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_sci_g3 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS aral_math_g4 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_read_g4 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_sci_g4 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS aral_math_g5 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_read_g5 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_sci_g5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS aral_math_g6 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_read_g6 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS aral_sci_g6 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS aral_total INTEGER DEFAULT 0,

        -- Teaching Experience
        ADD COLUMN IF NOT EXISTS teach_exp_0_1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_2_5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_6_10 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_11_15 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_16_20 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_21_25 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_26_30 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_31_35 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_36_40 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS teach_exp_40_45 INTEGER DEFAULT 0;
      `);
        console.log(`✅ [${dbLabel}] ARAL & Teaching Experience Columns Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to migrate ARAL/Exp columns:`, migErr.message);
    }

    // --- 10. DETAILED ENROLLMENT ---
    try {
        await client.query(`
        ALTER TABLE school_profiles 
        -- Elementary
        ADD COLUMN IF NOT EXISTS grade_kinder INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_1 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_2 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_3 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_4 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_5 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_6 INTEGER DEFAULT 0,

        -- JHS
        ADD COLUMN IF NOT EXISTS grade_7 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_8 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_9 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_10 INTEGER DEFAULT 0,

        -- SHS Grade 11
        ADD COLUMN IF NOT EXISTS abm_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS stem_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS humss_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS gas_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_ict_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_he_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_ia_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_afa_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS arts_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sports_11 INTEGER DEFAULT 0,

        -- SHS Grade 12
        ADD COLUMN IF NOT EXISTS abm_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS stem_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS humss_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS gas_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_ict_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_he_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_ia_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tvl_afa_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS arts_12 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sports_12 INTEGER DEFAULT 0,

        -- Totals
        ADD COLUMN IF NOT EXISTS es_enrollment INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS jhs_enrollment INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS shs_enrollment INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_enrollment INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_11 INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grade_12 INTEGER DEFAULT 0;
      `);
        console.log(`✅ [${dbLabel}] Detailed Enrollment Columns Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to migrate enrollment columns:`, migErr.message);
    }

    // --- 11. BUILDABLE SPACE TYPE FIX ---
    try {
        await client.query(`ALTER TABLE school_profiles ALTER COLUMN res_buildable_space TYPE TEXT;`);
        console.log(`✅ [${dbLabel}] Ensured buildable_space is TEXT`);
    } catch (migErr) { }

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

    // --- 13. MONITORING SNAPSHOT COLUMNS ---
    try {
        await client.query(`
          ALTER TABLE school_profiles 
          ADD COLUMN IF NOT EXISTS forms_completed_count INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS completion_percentage NUMERIC DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f1_profile INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f2_head INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f3_enrollment INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f4_classes INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f5_teachers INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f6_specialization INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f7_resources INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f8_facilities INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f9_shifting INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS f10_stats INTEGER DEFAULT 0;
        `);
        console.log(`✅ [${dbLabel}] Monitoring Snapshot Columns Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to migrate snapshot columns:`, migErr.message);
    }

    // --- 14. PENDING SCHOOLS TABLE (SDO Submission & Admin Approval) ---
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS pending_schools (
                pending_id SERIAL PRIMARY KEY,
                
                -- School Information (exact match to schools table)
                school_id TEXT UNIQUE NOT NULL,
                school_name TEXT NOT NULL,
                region TEXT NOT NULL,
                division TEXT NOT NULL,
                district TEXT,
                province TEXT,
                municipality TEXT,
                legislative_district TEXT,
                barangay TEXT,
                street_address TEXT,
                mother_school_id TEXT,
                curricular_offering TEXT,
                
                -- Location Data
                latitude NUMERIC(10, 7),
                longitude NUMERIC(10, 7),
                
                -- Submission Metadata
                submitted_by TEXT NOT NULL,
                submitted_by_name TEXT,
                submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                
                -- Approval Status
                status TEXT DEFAULT 'pending',
                reviewed_by TEXT,
                reviewed_by_name TEXT,
                reviewed_at TIMESTAMPTZ,
                rejection_reason TEXT,
                admin_comment TEXT
            );
        `);
        console.log(`✅ [${dbLabel}] Pending Schools Table Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to create pending_schools table:`, migErr.message);
    }

    // --- 15. SCHOOL DOCUMENTS TABLE (SDO PDF Submissions) ---
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS school_documents (
                id SERIAL PRIMARY KEY,
                pending_id INTEGER,
                school_id TEXT,
                doc_type TEXT NOT NULL,
                file_data TEXT, -- Base64 fallback
                binary_id UUID, -- Postgres Binary reference
                file_path TEXT, -- Virtual path or Data URI
                file_name TEXT, -- Original Filename
                file_size BIGINT,
                original_size BIGINT,
                hydra_manifest JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // Idempotent migrations for existing tables
        await client.query('ALTER TABLE school_documents ADD COLUMN IF NOT EXISTS pending_id INTEGER;').catch(() => {});
        await client.query('ALTER TABLE school_documents ADD COLUMN IF NOT EXISTS file_name TEXT;').catch(() => {});
        await client.query('ALTER TABLE school_documents ADD COLUMN IF NOT EXISTS binary_id UUID;').catch(() => {});
        await client.query('ALTER TABLE school_documents ADD COLUMN IF NOT EXISTS hydra_manifest JSONB;').catch(() => {});
        
        await client.query('CREATE INDEX IF NOT EXISTS idx_school_docs_pending ON school_documents(pending_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_school_docs_school ON school_documents(school_id);');
        
        console.log(`✅ [${dbLabel}] School Documents Table Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to init school_documents table:`, migErr.message);
    }

    // --- 16. FACILITY REPAIRS TABLE ---
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS facility_repairs (
                repair_id SERIAL PRIMARY KEY,
                school_id TEXT NOT NULL,
                iern TEXT,
                building_no TEXT,
                room_no TEXT,
                remarks TEXT,
                
                -- Repair Items (Booleans stored as TRUE/FALSE)
                repair_roofing BOOLEAN DEFAULT FALSE,
                repair_ceiling_ext BOOLEAN DEFAULT FALSE,
                repair_ceiling_int BOOLEAN DEFAULT FALSE,
                repair_wall_ext BOOLEAN DEFAULT FALSE,
                repair_partition BOOLEAN DEFAULT FALSE,
                repair_door BOOLEAN DEFAULT FALSE,
                repair_windows BOOLEAN DEFAULT FALSE,
                repair_flooring BOOLEAN DEFAULT FALSE,
                repair_structural BOOLEAN DEFAULT FALSE,

                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // --- MIGRATION: ADD MISSING COLUMNS IF TABLE EXISTS ---
        await client.query(`
            ALTER TABLE facility_repairs 
            ADD COLUMN IF NOT EXISTS repair_roofing BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS repair_ceiling_ext BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS repair_ceiling_int BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS repair_wall_ext BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS repair_partition BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS repair_door BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS repair_windows BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS repair_flooring BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS repair_structural BOOLEAN DEFAULT FALSE;
        `);
        console.log(`✅ [${dbLabel}] Facility Repairs Table Initialized & Updated`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to init facility_repairs table:`, migErr.message);
    }
    // --- 16. FINANCE PROJECTS TABLE ---
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS finance_projects (
                finance_id SERIAL PRIMARY KEY,
                school_id TEXT NOT NULL,
                school_name TEXT,
                project_name TEXT,
                region TEXT,
                division TEXT,
                municipality TEXT,
                district TEXT,
                legislative_district TEXT,
                total_funds NUMERIC,
                fund_released NUMERIC,
                date_of_release TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                root_id TEXT
            );
        `);
        // --- MIGRATION: ADD updated_at and root_id if missing ---
        await client.query(`
            ALTER TABLE finance_projects 
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS root_id TEXT;
        `);

        // --- MIGRATION: BACKFILL root_id ---
        // If root_id is NULL, set it to 'FIN-' + finance_id
        await client.query(`
            UPDATE finance_projects 
            SET root_id = 'FIN-' || finance_id 
            WHERE root_id IS NULL;
        `);

        console.log(`✅ [${dbLabel}] Finance Projects Table Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to init finance_projects table:`, migErr.message);
    }

    // --- 16. FACILITY INVENTORY TABLE ---
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS facility_inventory (
                id SERIAL PRIMARY KEY,
                school_id TEXT,
                iern TEXT,
                building_name TEXT NOT NULL,
                category TEXT NOT NULL,
                status TEXT NOT NULL,
                no_of_storeys INTEGER DEFAULT 1,
                no_of_classrooms INTEGER NOT NULL,
                year_completed INTEGER,
                remarks TEXT,
                grade_level TEXT,
                teacher_name TEXT,
                less_than_7x9 INTEGER DEFAULT 0,
                "7x9" INTEGER DEFAULT 0,
                above_7x9 INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_facility_inventory_iern ON facility_inventory(iern);`);
        console.log(`✅ [${dbLabel}] Facility Inventory Table Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to init facility_inventory table:`, migErr.message);
    }

    // --- 16b. FACILITY ROOMS TABLE ---
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS facility_rooms (
                room_id SERIAL PRIMARY KEY,
                building_id INTEGER REFERENCES facility_inventory(id) ON DELETE CASCADE,
                school_id TEXT,
                room_name TEXT NOT NULL,
                dimension TEXT,
                grade_level TEXT,
                advisory_teacher TEXT,
                condition TEXT, -- NEWLY BUILT, GOOD CONDITION, REPAIR
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_facility_rooms_school_id ON facility_rooms(school_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_facility_rooms_building_id ON facility_rooms(building_id);`);
        console.log(`✅ [${dbLabel}] Facility Rooms Table Initialized`);
    } catch (migErr) {
        console.error(`❌ [${dbLabel}] Failed to init facility_rooms table:`, migErr.message);
    }
    // =========================================================================
    // --- 17. PH_SCHOOLS — CANONICAL COLUMN SCHEMA (Unit 1 → 9 Order) -------
    // =========================================================================
    // All ph_schools columns are ensured here in their logical unit order.
    // Run `node api/reorder_ph_schools.js` once on any existing database to
    // physically reorder columns to match this declaration.
    // =========================================================================
    try {
        // ── CREATE TABLE (no-op if already exists) ───────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS ph_schools (
                iern        TEXT PRIMARY KEY,
                school_id   TEXT UNIQUE,
                created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ── UNIT 1: School Identity ──────────────────────────────────────────
        await client.query(`
            ALTER TABLE ph_schools
            ADD COLUMN IF NOT EXISTS verified_as_of             TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS school_name                TEXT,
            ADD COLUMN IF NOT EXISTS region                     TEXT,
            ADD COLUMN IF NOT EXISTS province                   TEXT,
            ADD COLUMN IF NOT EXISTS municipality               TEXT,
            ADD COLUMN IF NOT EXISTS barangay                   TEXT,
            ADD COLUMN IF NOT EXISTS division                   TEXT,
            ADD COLUMN IF NOT EXISTS district                   TEXT,
            ADD COLUMN IF NOT EXISTS leg_district               TEXT,
            ADD COLUMN IF NOT EXISTS curricular_offering        TEXT,
            ADD COLUMN IF NOT EXISTS latitude                   TEXT,
            ADD COLUMN IF NOT EXISTS longitude                  TEXT,
            ADD COLUMN IF NOT EXISTS school_head                TEXT,
            ADD COLUMN IF NOT EXISTS contact_number             TEXT,
            ADD COLUMN IF NOT EXISTS ownership                  TEXT,
            ADD COLUMN IF NOT EXISTS ownership_document_path   TEXT,
            ADD COLUMN IF NOT EXISTS ownership_document_type   TEXT,
            ADD COLUMN IF NOT EXISTS google_drive_link          TEXT,
            ADD COLUMN IF NOT EXISTS google_drive_file_id       TEXT,
            ADD COLUMN IF NOT EXISTS google_drive_file_name     TEXT,
            ADD COLUMN IF NOT EXISTS google_drive_thumbnail_url TEXT,
            ADD COLUMN IF NOT EXISTS school_type                TEXT,
            ADD COLUMN IF NOT EXISTS mother_school_id           TEXT,
            ADD COLUMN IF NOT EXISTS extension_mother_school_name TEXT,
            ADD COLUMN IF NOT EXISTS established_month          TEXT,
            ADD COLUMN IF NOT EXISTS established_year           TEXT,
            ADD COLUMN IF NOT EXISTS head_first_name            TEXT,
            ADD COLUMN IF NOT EXISTS head_middle_name           TEXT,
            ADD COLUMN IF NOT EXISTS head_last_name             TEXT,
            ADD COLUMN IF NOT EXISTS head_sex                   TEXT,
            ADD COLUMN IF NOT EXISTS head_position_title        TEXT,
            ADD COLUMN IF NOT EXISTS head_date_of_birth         TEXT,
            ADD COLUMN IF NOT EXISTS head_date_hired            TEXT,
            ADD COLUMN IF NOT EXISTS ownership_na_reason        TEXT,
            ADD COLUMN IF NOT EXISTS unit1                      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit1_completed            BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS submitted_by               TEXT,
            ADD COLUMN IF NOT EXISTS unit1_updated_at           TIMESTAMPTZ;
        `);

        // ── UNIT 2: Learners (Enrollment) ────────────────────────────────────
        await client.query(`
            ALTER TABLE ph_schools
            ADD COLUMN IF NOT EXISTS enroll_kinder              INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS enroll_g1                  INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS enroll_g2                  INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS enroll_g3                  INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS enroll_g4                  INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS enroll_g5                  INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS enroll_g6                  INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS enroll_g7                  INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS enroll_g8                  INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS enroll_g9                  INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS enroll_g10                 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS enroll_g11                 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS enroll_g12                 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_enrollment           INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS male_enrollment            INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS female_enrollment          INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_male                INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_female              INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS kinder_male              INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS kinder_female            INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS g1_male                  INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS g1_female                INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS g2_male                  INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS g2_female                INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS g3_male                  INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS g3_female                INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS g4_male                  INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS g4_female                INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS g5_male                  INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS g5_female                INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS g6_male                  INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS g6_female                INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS g7_male                  INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS g7_female                INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS g8_male                  INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS g8_female                INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS g9_male                  INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS g9_female                INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS g10_male                 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS g10_female               INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS g11_male                 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS g11_female               INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS g12_male                 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS g12_female               INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS sned_male                INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS sned_female              INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS sned_self_contained_count  INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit2_simplified_enrollment TEXT,
            ADD COLUMN IF NOT EXISTS multigrade_groupings_1     TEXT,
            ADD COLUMN IF NOT EXISTS multigrade_groupings_2     TEXT,
            ADD COLUMN IF NOT EXISTS multigrade_groupings_3     TEXT,
            ADD COLUMN IF NOT EXISTS multigrade_enrollment_1    INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS multigrade_enrollment_2    INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS multigrade_enrollment_3    INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit2                      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit2_completed            BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS unit2_updated_at           TIMESTAMPTZ;
        `);

        // ── UNIT 3: Organized Classes ────────────────────────────────────────
        await client.query(`
            ALTER TABLE ph_schools
            ADD COLUMN IF NOT EXISTS has_multigrade             BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS multigrade_sections_count  INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit3_simplified_counts    JSONB,
            ADD COLUMN IF NOT EXISTS grade_kinder_size          TEXT,
            ADD COLUMN IF NOT EXISTS grade_1_size               TEXT,
            ADD COLUMN IF NOT EXISTS grade_2_size               TEXT,
            ADD COLUMN IF NOT EXISTS grade_3_size               TEXT,
            ADD COLUMN IF NOT EXISTS grade_4_size               TEXT,
            ADD COLUMN IF NOT EXISTS grade_5_size               TEXT,
            ADD COLUMN IF NOT EXISTS grade_6_size               TEXT,
            ADD COLUMN IF NOT EXISTS grade_7_size               TEXT,
            ADD COLUMN IF NOT EXISTS grade_8_size               TEXT,
            ADD COLUMN IF NOT EXISTS grade_9_size               TEXT,
            ADD COLUMN IF NOT EXISTS grade_10_size              TEXT,
            ADD COLUMN IF NOT EXISTS grade_11_size              TEXT,
            ADD COLUMN IF NOT EXISTS grade_12_size              TEXT,
            ADD COLUMN IF NOT EXISTS multigrade_size_1          TEXT,
            ADD COLUMN IF NOT EXISTS multigrade_size_2          TEXT,
            ADD COLUMN IF NOT EXISTS multigrade_size_3          TEXT,
            ADD COLUMN IF NOT EXISTS unit3                      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit3_completed            BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS unit3_updated_at           TIMESTAMPTZ;
        `);

        // ── UNIT 4: Learner Profile ──────────────────────────────────────────
        await client.query(`
            ALTER TABLE ph_schools
            ADD COLUMN IF NOT EXISTS selected_learner_groups    JSONB,
            ADD COLUMN IF NOT EXISTS bmi_severely_wasted        INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS bmi_wasted                 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS bmi_overweight_obese       INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS bmi_normal                 INTEGER DEFAULT 0,
            -- ALS
            ADD COLUMN IF NOT EXISTS als_kinder INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS als_g1 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS als_g2 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS als_g3 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS als_g4 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS als_g5 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS als_g6 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS als_g7 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS als_g8 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS als_g9 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS als_g10 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS als_g11 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS als_g12 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS als_total INTEGER DEFAULT 0,
            -- Muslim
            ADD COLUMN IF NOT EXISTS muslim_kinder INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS muslim_g1 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS muslim_g2 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS muslim_g3 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS muslim_g4 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS muslim_g5 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS muslim_g6 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS muslim_g7 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS muslim_g8 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS muslim_g9 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS muslim_g10 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS muslim_g11 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS muslim_g12 INTEGER DEFAULT 0,
            -- IP
            ADD COLUMN IF NOT EXISTS ip_kinder INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS ip_g1 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS ip_g2 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS ip_g3 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS ip_g4 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS ip_g5 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS ip_g6 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS ip_g7 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS ip_g8 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS ip_g9 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS ip_g10 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS ip_g11 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS ip_g12 INTEGER DEFAULT 0,
            -- Displaced
            ADD COLUMN IF NOT EXISTS displaced_kinder INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS displaced_g1 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS displaced_g2 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS displaced_g3 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS displaced_g4 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS displaced_g5 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS displaced_g6 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS displaced_g7 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS displaced_g8 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS displaced_g9 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS displaced_g10 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS displaced_g11 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS displaced_g12 INTEGER DEFAULT 0,
            -- Overage
            ADD COLUMN IF NOT EXISTS overage_kinder INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS overage_g1 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS overage_g2 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS overage_g3 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS overage_g4 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS overage_g5 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS overage_g6 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS overage_g7 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS overage_g8 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS overage_g9 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS overage_g10 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS overage_g11 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS overage_g12 INTEGER DEFAULT 0,
            -- Dropout
            ADD COLUMN IF NOT EXISTS dropout_kinder INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS dropout_g1 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS dropout_g2 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS dropout_g3 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS dropout_g4 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS dropout_g5 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS dropout_g6 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS dropout_g7 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS dropout_g8 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS dropout_g9 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS dropout_g10 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS dropout_g11 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS dropout_g12 INTEGER DEFAULT 0,
            -- Repeater
            ADD COLUMN IF NOT EXISTS repeater_kinder INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS repeater_g1 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS repeater_g2 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS repeater_g3 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS repeater_g4 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS repeater_g5 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS repeater_g6 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS repeater_g7 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS repeater_g8 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS repeater_g9 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS repeater_g10 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS repeater_g11 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS repeater_g12 INTEGER DEFAULT 0,
            -- LWD
            ADD COLUMN IF NOT EXISTS lwd_kinder INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS lwd_g1 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS lwd_g2 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS lwd_g3 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS lwd_g4 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS lwd_g5 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS lwd_g6 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS lwd_g7 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS lwd_g8 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS lwd_g9 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS lwd_g10 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS lwd_g11 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS lwd_g12 INTEGER DEFAULT 0,
            -- SNED per grade
            ADD COLUMN IF NOT EXISTS sned_kinder INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS sned_g1 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS sned_g2 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS sned_g3 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS sned_g4 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS sned_g5 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS sned_g6 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS sned_g7 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS sned_g8 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS sned_g9 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS sned_g10 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS sned_g11 INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS sned_g12 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit4                      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit4_completed            BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS unit4_updated_at           TIMESTAMPTZ;
        `);

        // ── UNIT 5: Shifting & Modality ──────────────────────────────────────
        await client.query(`
            ALTER TABLE ph_schools
            ADD COLUMN IF NOT EXISTS has_standard_shifting      BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS adm_mdl                    BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS adm_odl                    BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS adm_tvi                    BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS adm_blended                BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS shifting_modality          TEXT,
            -- Shift per level (K-12 + multigrade)
            ADD COLUMN IF NOT EXISTS shift_kinder TEXT,
            ADD COLUMN IF NOT EXISTS shift_g1 TEXT, ADD COLUMN IF NOT EXISTS shift_g2 TEXT,
            ADD COLUMN IF NOT EXISTS shift_g3 TEXT, ADD COLUMN IF NOT EXISTS shift_g4 TEXT,
            ADD COLUMN IF NOT EXISTS shift_g5 TEXT, ADD COLUMN IF NOT EXISTS shift_g6 TEXT,
            ADD COLUMN IF NOT EXISTS shift_g7 TEXT, ADD COLUMN IF NOT EXISTS shift_g8 TEXT,
            ADD COLUMN IF NOT EXISTS shift_g9 TEXT, ADD COLUMN IF NOT EXISTS shift_g10 TEXT,
            ADD COLUMN IF NOT EXISTS shift_g11 TEXT, ADD COLUMN IF NOT EXISTS shift_g12 TEXT,
            ADD COLUMN IF NOT EXISTS shift_mg_1 TEXT, ADD COLUMN IF NOT EXISTS shift_mg_2 TEXT, ADD COLUMN IF NOT EXISTS shift_mg_3 TEXT,
            -- Mode per level (K-12 + multigrade)
            ADD COLUMN IF NOT EXISTS mode_kinder TEXT,
            ADD COLUMN IF NOT EXISTS mode_g1 TEXT, ADD COLUMN IF NOT EXISTS mode_g2 TEXT,
            ADD COLUMN IF NOT EXISTS mode_g3 TEXT, ADD COLUMN IF NOT EXISTS mode_g4 TEXT,
            ADD COLUMN IF NOT EXISTS mode_g5 TEXT, ADD COLUMN IF NOT EXISTS mode_g6 TEXT,
            ADD COLUMN IF NOT EXISTS mode_g7 TEXT, ADD COLUMN IF NOT EXISTS mode_g8 TEXT,
            ADD COLUMN IF NOT EXISTS mode_g9 TEXT, ADD COLUMN IF NOT EXISTS mode_g10 TEXT,
            ADD COLUMN IF NOT EXISTS mode_g11 TEXT, ADD COLUMN IF NOT EXISTS mode_g12 TEXT,
            ADD COLUMN IF NOT EXISTS mode_mg_1 TEXT, ADD COLUMN IF NOT EXISTS mode_mg_2 TEXT, ADD COLUMN IF NOT EXISTS mode_mg_3 TEXT,
            ADD COLUMN IF NOT EXISTS unit5                      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit5_completed            BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS unit5_updated_at           TIMESTAMPTZ;
        `);

        // ── UNIT 6: Teaching Personnel (snapshot — roster in teachers_list) ──
        await client.query(`
            ALTER TABLE ph_schools
            ADD COLUMN IF NOT EXISTS total_teachers_registered  INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_teachers_kinder      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_teachers_elementary  INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_teachers_jhs         INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_teachers_shs         INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit6                      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit6_completed            BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS unit6_updated_at           TIMESTAMPTZ;
        `);

        // ── UNIT 7: School Resources ─────────────────────────────────────────
        await client.query(`
            ALTER TABLE ph_schools
            ADD COLUMN IF NOT EXISTS unit7_furniture            TEXT,
            ADD COLUMN IF NOT EXISTS unit7_ict                  TEXT,
            ADD COLUMN IF NOT EXISTS unit7_has_ecart            BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS unit7_ecarts               TEXT,
            ADD COLUMN IF NOT EXISTS unit7_wash                 TEXT,
            ADD COLUMN IF NOT EXISTS unit7_utilities            TEXT,
            ADD COLUMN IF NOT EXISTS u7_ict_smart_tv_cond       TEXT,
            ADD COLUMN IF NOT EXISTS u7_ict_projector_cond      TEXT,
            ADD COLUMN IF NOT EXISTS u7_ict_printer_cond        TEXT,
            ADD COLUMN IF NOT EXISTS u7_wash_male_seats_cond    TEXT,
            ADD COLUMN IF NOT EXISTS u7_wash_female_seats_cond  TEXT,
            ADD COLUMN IF NOT EXISTS u7_wash_common_seats_cond  TEXT,
            ADD COLUMN IF NOT EXISTS u7_wash_pwd_seats_cond     TEXT,
            ADD COLUMN IF NOT EXISTS u7_wash_faucets_cond       TEXT,
            ADD COLUMN IF NOT EXISTS u7_confirm_no_grid         BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS u7_confirm_no_piped        BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS u7_confirm_zero_wash       BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS u7_confirm_no_wired        BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS u7_utility_internet_type   TEXT,
            ADD COLUMN IF NOT EXISTS unit7                      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit7_completed            BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS unit7_updated_at           TIMESTAMPTZ;
        `);

        // ── UNIT 8: Physical Facilities (aggregate snapshots) ────────────────
        await client.query(`
            ALTER TABLE ph_schools
            ADD COLUMN IF NOT EXISTS bldg_count_good            INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS bldg_count_minor_repair    INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS bldg_count_major_repair    INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS it_laptop_total            INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS it_tablet_total            INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS it_pc_total                INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS it_printer_total           INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS it_ecart_total             INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit8                      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit8_completed            BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS unit8_updated_at           TIMESTAMPTZ;
        `);

        // ── UNIT 9: School Location / Terrain ────────────────────────────────
        await client.query(`
            ALTER TABLE ph_schools
            ADD COLUMN IF NOT EXISTS hazard_risk_score          INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit9                      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit9_completed            BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS unit9_updated_at           TIMESTAMPTZ;
        `);

        // ── UNIT 10: Verification ────────────────────────────────────────────
        await client.query(`
            ALTER TABLE ph_schools
            ADD COLUMN IF NOT EXISTS unit10                     INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit10_completed           BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS unit10_updated_at          TIMESTAMPTZ;
        `);

        // ── MONITORING / COMPLETION SNAPSHOT ─────────────────────────────────
        await client.query(`
            ALTER TABLE ph_schools
            ADD COLUMN IF NOT EXISTS unit_completion            NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS forms_completed_count      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS completion_percentage      NUMERIC DEFAULT 0;
        `);

        // ── INDEXES ───────────────────────────────────────────────────────────
        await client.query(`DROP INDEX IF EXISTS idx_ph_schools_school_id;`);
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_ph_schools_school_id
            ON ph_schools(school_id);
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_ph_schools_division  ON ph_schools(division);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_ph_schools_region    ON ph_schools(region);`);
        
        // Compound index for regional dashboard aggregations (HAWKEYE Protocol)
        await client.query(`CREATE INDEX IF NOT EXISTS idx_ph_schools_regional_summary ON ph_schools(region, division);`);

        console.log(`✅ [${dbLabel}] ph_schools canonical schema (Unit 1-9) ensured`);
    } catch (migErr) {
        if (!migErr.message?.includes('does not exist')) {
            console.error(`❌ [${dbLabel}] Failed to ensure ph_schools schema:`, migErr.message);
        }
    }

    // --- 18. CHATBOT KNOWLEDGE TABLE ---
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

    // --- 19. SYSTEM FEEDBACK TABLE ---
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

    // --- 20. APP FEEDBACK TABLE (DETAILED) ---
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
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Idempotent column additions
        await client.query(`ALTER TABLE school_ownership_docs ADD COLUMN IF NOT EXISTS binary_id UUID;`).catch(() => {});
        await client.query(`ALTER TABLE school_ownership_docs ADD COLUMN IF NOT EXISTS file_size BIGINT;`).catch(() => {});
        await client.query(`ALTER TABLE school_ownership_docs ADD COLUMN IF NOT EXISTS original_size BIGINT;`).catch(() => {});
        await client.query(`ALTER TABLE school_ownership_docs ADD COLUMN IF NOT EXISTS hydra_manifest JSONB;`).catch(() => {});
        await client.query(`ALTER TABLE school_ownership_docs ADD COLUMN IF NOT EXISTS school_id TEXT;`).catch(() => {});

        // Data Healing: Cleanup orphans to allow FK creation
        await client.query("DELETE FROM school_ownership_docs WHERE iern NOT IN (SELECT iern FROM ph_schools)");

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

    // NOTE: Unit 7 condition & utility columns are now included in the
    // canonical ph_schools schema block above (migration #17). Removed
    // duplicate migrations #22 and #23.

    // --- 22. IPC INDEXING & BACKFILL ---
    try {
        // Ensure ipc column exists on engineer_image for older installs
        await client.query(`ALTER TABLE engineer_image ADD COLUMN IF NOT EXISTS ipc TEXT;`);

        // B-tree indices for fast IPC-based lookups across all asset tables
        // B-tree indices for fast IPC-based lookups across all asset tables
        // Redundant global index removed; keeping partial index for efficiency
        
        await client.query(`CREATE INDEX IF NOT EXISTS idx_engineer_image_ipc     ON engineer_image(ipc);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_engineer_documents_ipc ON engineer_documents(ipc);`);

        // Partial index: most IPC queries exclude null rows; this index is smaller and faster
        await client.query(`CREATE INDEX IF NOT EXISTS idx_engineer_form_ipc_partial ON engineer_form(ipc) WHERE ipc IS NOT NULL;`);

        // Dedicated file_path column for disk-based images (image_data may still hold legacy base64)
        await client.query(`ALTER TABLE engineer_image ADD COLUMN IF NOT EXISTS file_path TEXT;`);

        // Deduplicate engineer_documents: keep only the latest row per IPC before adding unique constraint
        // The latest row always carries the most complete set of documents (due to carry-over logic in save-project)
        await client.query(`
            DELETE FROM engineer_documents
            WHERE doc_id NOT IN (
                SELECT DISTINCT ON (ipc) doc_id
                FROM engineer_documents
                WHERE ipc IS NOT NULL
                ORDER BY ipc, created_at DESC NULLS LAST
            )
            AND ipc IS NOT NULL;
        `);

        // Partial UNIQUE index: one canonical document record per IPC
        // Rows with null IPC (legacy records without backfilled IPC) are excluded
        await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_engineer_documents_ipc_unique ON engineer_documents(ipc) WHERE ipc IS NOT NULL;`);

        // Backfill null ipc in engineer_image by joining on project_id
        await client.query(`
            UPDATE engineer_image ei
            SET ipc = ef.ipc
            FROM engineer_form ef
            WHERE ei.project_id = ef.project_id
              AND ei.ipc IS NULL
              AND ef.ipc IS NOT NULL;
        `);

        // Backfill null ipc in engineer_documents by joining on project_id
        await client.query(`
            UPDATE engineer_documents ed
            SET ipc = ef.ipc
            FROM engineer_form ef
            WHERE ed.project_id = ef.project_id
              AND ed.ipc IS NULL
              AND ef.ipc IS NOT NULL;
        `);

        console.log(`✅ [${dbLabel}] IPC Indices and Backfill Complete`);
    } catch (ipcErr) {
        console.error(`❌ [${dbLabel}] IPC Migration Failed:`, ipcErr.message);
    }

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

        // Add binary_id reference column to engineer_image (nullable for backward compat)
        await client.query(`ALTER TABLE engineer_image ADD COLUMN IF NOT EXISTS binary_id UUID REFERENCES unified_binaries(id) ON DELETE SET NULL;`);
        
        // Ensure LGU projects also support Hydra
        await client.query(`ALTER TABLE lgu_projects ADD COLUMN IF NOT EXISTS hydra_manifest JSONB;`).catch(() => {});
        await client.query(`ALTER TABLE lgu_projects ADD COLUMN IF NOT EXISTS pow_original_size BIGINT;`).catch(() => {});
        await client.query(`ALTER TABLE lgu_projects ADD COLUMN IF NOT EXISTS dupa_original_size BIGINT;`).catch(() => {});
        await client.query(`ALTER TABLE lgu_projects ADD COLUMN IF NOT EXISTS contract_original_size BIGINT;`).catch(() => {});
        await client.query(`ALTER TABLE lgu_projects ADD COLUMN IF NOT EXISTS moa_original_size BIGINT;`).catch(() => {});
        await client.query(`ALTER TABLE lgu_projects ADD COLUMN IF NOT EXISTS rta_original_size BIGINT;`).catch(() => {});

        console.log(`✅ [${dbLabel}] Unified Binaries Table & Indices Initialized`);
    } catch (binErr) {
        console.error(`❌ [${dbLabel}] Unified Binaries Migration Failed:`, binErr.message);
    }

    // --- 26. UNIT 7: PHYSICAL FACILITIES ---
    await initUnit7Schema(client, dbLabel);

};

export { initOtpTable, runMigrations };
