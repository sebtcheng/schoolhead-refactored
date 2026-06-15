
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
        `).catch(() => { });

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

        // 4. Buildings Inventory Table (ph_buildings_inventory)
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

        // 5. Buildable Spaces Table (ph_school_buildable_spaces)
        await client.query(`
            CREATE TABLE IF NOT EXISTS ph_school_buildable_spaces (
                id SERIAL PRIMARY KEY,
                school_id VARCHAR(255),
                iern VARCHAR(255),
                space_name TEXT,
                center_lat NUMERIC,
                center_lng NUMERIC,
                length_m NUMERIC,
                width_m NUMERIC,
                rotation_deg NUMERIC,
                total_area_sqm NUMERIC,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_ph_school_buildable_spaces_iern_name 
            ON ph_school_buildable_spaces(iern, space_name);
        `).catch(() => { });

        // 6. [NEW] Unit 7 Facilities Summary Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS unit7_facilities (
                iern VARCHAR(255) PRIMARY KEY,
                school_id VARCHAR(255) UNIQUE,
                unit7 INTEGER DEFAULT 0,
                unit7_completed BOOLEAN DEFAULT FALSE,
                unit7_updated_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                unit7_no_buildings INTEGER DEFAULT 0,
                unit7_no_rooms INTEGER DEFAULT 0,
                unit7_has_buildable_space BOOLEAN DEFAULT TRUE,
                unit7_no_buildable_space INTEGER DEFAULT 0,
                unit7_no_repair_rooms INTEGER DEFAULT 0,
                unit7_no_demolition INTEGER DEFAULT 0
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
                    weather_isolation_6mo INTEGER DEFAULT 0,
                    anthropogenic_threats JSONB DEFAULT '[]',
                    risk_index TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // [NEW] Unit 8 Location Profile (New Table)
            await client.query(`
                CREATE TABLE IF NOT EXISTS unit8_location (
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
                    weather_isolation_6mo INTEGER DEFAULT 0,
                    anthropogenic_threats JSONB DEFAULT '[]',
                    risk_index TEXT,
                    unit8 INTEGER DEFAULT 0,
                    unit8_completed BOOLEAN DEFAULT FALSE,
                    unit8_updated_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Ensure columns exist on already created tables
            await client.query(`
                ALTER TABLE unit8_location ADD COLUMN IF NOT EXISTS unit8 INTEGER DEFAULT 0;
                ALTER TABLE unit8_location ADD COLUMN IF NOT EXISTS unit8_completed BOOLEAN DEFAULT FALSE;
                ALTER TABLE unit8_location ADD COLUMN IF NOT EXISTS unit8_updated_at TIMESTAMPTZ;
                ALTER TABLE unit8_location ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            `);

            // [NEW] Unit 9 Safety & Infrastructure (New Table)
            await client.query(`
                CREATE TABLE IF NOT EXISTS unit9_safety (
                    school_id TEXT PRIMARY KEY,
                    iern TEXT,
                    u9_general JSONB,
                    u9_wiring JSONB,
                    u9_cords_cctv JSONB,
                    u9_final JSONB,
                    u9_fire_exit_exists BOOLEAN DEFAULT FALSE,
                    u9_backup_light_exists BOOLEAN DEFAULT FALSE,
                    u9_ecart_load_ready BOOLEAN DEFAULT FALSE,
                    u9_has_surge_protection BOOLEAN DEFAULT FALSE,
                    u9_remarks TEXT,
                    u9_cctv_working INTEGER DEFAULT 0,
                    u9_cctv_broken INTEGER DEFAULT 0,
                    u9_cctv_spares INTEGER DEFAULT 0,
                    u9_fire_ext_working INTEGER DEFAULT 0,
                    u9_fire_ext_broken INTEGER DEFAULT 0,
                    u9_fire_ext_spares INTEGER DEFAULT 0,
                    u9_first_aid_working INTEGER DEFAULT 0,
                    u9_first_aid_broken INTEGER DEFAULT 0,
                    u9_first_aid_spares INTEGER DEFAULT 0,
                    u9_bullhorns_working INTEGER DEFAULT 0,
                    u9_bullhorns_broken INTEGER DEFAULT 0,
                    u9_bullhorns_spares INTEGER DEFAULT 0,
                    u9_radios_working INTEGER DEFAULT 0,
                    u9_radios_broken INTEGER DEFAULT 0,
                    u9_radios_spares INTEGER DEFAULT 0,
                    u9_flashlight_working INTEGER DEFAULT 0,
                    u9_flashlight_broken INTEGER DEFAULT 0,
                    u9_flashlight_spares INTEGER DEFAULT 0,
                    u9_whistles_quantity INTEGER DEFAULT 0,
                    u9_bulbs_working INTEGER DEFAULT 0,
                    u9_bulbs_broken INTEGER DEFAULT 0,
                    u9_bulbs_spares INTEGER DEFAULT 0,
                    u9_covers_working INTEGER DEFAULT 0,
                    u9_covers_broken INTEGER DEFAULT 0,
                    u9_covers_spares INTEGER DEFAULT 0,
                    u9_breakers_working INTEGER DEFAULT 0,
                    u9_breakers_broken INTEGER DEFAULT 0,
                    u9_breakers_spares INTEGER DEFAULT 0,
                    u9_ext_cords_working INTEGER DEFAULT 0,
                    u9_ext_cords_broken INTEGER DEFAULT 0,
                    u9_ext_cords_spares INTEGER DEFAULT 0,
                    u9_tape_quantity INTEGER DEFAULT 0,
                    unit9 INTEGER DEFAULT 0,
                    unit9_completed BOOLEAN DEFAULT FALSE,
                    unit9_updated_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Ensure unit9_safety columns exist on already created tables
            await client.query(`
                ALTER TABLE unit9_safety ADD COLUMN IF NOT EXISTS unit9 INTEGER DEFAULT 0;
                ALTER TABLE unit9_safety ADD COLUMN IF NOT EXISTS unit9_completed BOOLEAN DEFAULT FALSE;
                ALTER TABLE unit9_safety ADD COLUMN IF NOT EXISTS unit9_updated_at TIMESTAMPTZ;
                ALTER TABLE unit9_safety ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
                ALTER TABLE unit9_safety ADD COLUMN IF NOT EXISTS iern TEXT;
            `);

            // Fix JSONB columns if they were created as INTEGER (type migration)
            await client.query(`
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unit9_safety' AND column_name = 'u9_general' AND data_type = 'integer') THEN
                        ALTER TABLE unit9_safety ALTER COLUMN u9_general TYPE JSONB USING to_jsonb(u9_general);
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unit9_safety' AND column_name = 'u9_wiring' AND data_type = 'integer') THEN
                        ALTER TABLE unit9_safety ALTER COLUMN u9_wiring TYPE JSONB USING to_jsonb(u9_wiring);
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unit9_safety' AND column_name = 'u9_cords_cctv' AND data_type = 'integer') THEN
                        ALTER TABLE unit9_safety ALTER COLUMN u9_cords_cctv TYPE JSONB USING to_jsonb(u9_cords_cctv);
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unit9_safety' AND column_name = 'u9_final' AND data_type = 'integer') THEN
                        ALTER TABLE unit9_safety ALTER COLUMN u9_final TYPE JSONB USING to_jsonb(u9_final);
                    END IF;
                END $$;
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

const initUnitTimestampTrigger = async (client, dbLabel) => {
    try {
        // [Hawkeye Protocol] Automated Accomplishment Timestamp Trigger
        // This ensures every unit completion (1-10) is timestamped at the moment of persistence.
        await client.query(`
            CREATE OR REPLACE FUNCTION update_unit_timestamp() 
            RETURNS TRIGGER AS $$
            BEGIN
                -- Unit 1
                IF (NEW.unit1 = 1 OR NEW.unit1 = 100 OR NEW.unit1_completed = TRUE) 
                   AND (OLD.unit1 IS DISTINCT FROM NEW.unit1 OR OLD.unit1_completed IS DISTINCT FROM NEW.unit1_completed) 
                   AND (NEW.unit1_updated_at IS NULL OR NEW.unit1_updated_at < (CURRENT_TIMESTAMP - INTERVAL '1 minute')) 
                THEN NEW.unit1_updated_at := CURRENT_TIMESTAMP; END IF;

                -- Unit 2
                IF (NEW.unit2 = 1 OR NEW.unit2 = 100 OR NEW.unit2_completed = TRUE) 
                   AND (OLD.unit2 IS DISTINCT FROM NEW.unit2 OR OLD.unit2_completed IS DISTINCT FROM NEW.unit2_completed) 
                   AND (NEW.unit2_updated_at IS NULL OR NEW.unit2_updated_at < (CURRENT_TIMESTAMP - INTERVAL '1 minute')) 
                THEN NEW.unit2_updated_at := CURRENT_TIMESTAMP; END IF;

                -- Unit 3
                IF (NEW.unit3 = 1 OR NEW.unit3 = 100 OR NEW.unit3_completed = TRUE) 
                   AND (OLD.unit3 IS DISTINCT FROM NEW.unit3 OR OLD.unit3_completed IS DISTINCT FROM NEW.unit3_completed) 
                   AND (NEW.unit3_updated_at IS NULL OR NEW.unit3_updated_at < (CURRENT_TIMESTAMP - INTERVAL '1 minute')) 
                THEN NEW.unit3_updated_at := CURRENT_TIMESTAMP; END IF;


                -- Unit 5
                IF (NEW.unit5 = 1 OR NEW.unit5 = 100 OR NEW.unit5_completed = TRUE) 
                   AND (OLD.unit5 IS DISTINCT FROM NEW.unit5 OR OLD.unit5_completed IS DISTINCT FROM NEW.unit5_completed) 
                   AND (NEW.unit5_updated_at IS NULL OR NEW.unit5_updated_at < (CURRENT_TIMESTAMP - INTERVAL '1 minute')) 
                THEN NEW.unit5_updated_at := CURRENT_TIMESTAMP; END IF;

                -- Unit 6
                IF (NEW.unit6 = 1 OR NEW.unit6 = 100 OR NEW.unit6_completed = TRUE) 
                   AND (OLD.unit6 IS DISTINCT FROM NEW.unit6 OR OLD.unit6_completed IS DISTINCT FROM NEW.unit6_completed) 
                   AND (NEW.unit6_updated_at IS NULL OR NEW.unit6_updated_at < (CURRENT_TIMESTAMP - INTERVAL '1 minute')) 
                THEN NEW.unit6_updated_at := CURRENT_TIMESTAMP; END IF;

                -- Unit 7
                IF (NEW.unit7 = 1 OR NEW.unit7 = 100 OR NEW.unit7_completed = TRUE) 
                   AND (OLD.unit7 IS DISTINCT FROM NEW.unit7 OR OLD.unit7_completed IS DISTINCT FROM NEW.unit7_completed) 
                   AND (NEW.unit7_updated_at IS NULL OR NEW.unit7_updated_at < (CURRENT_TIMESTAMP - INTERVAL '1 minute')) 
                THEN NEW.unit7_updated_at := CURRENT_TIMESTAMP; END IF;

                -- Unit 8
                IF (NEW.unit8 = 1 OR NEW.unit8 = 100 OR NEW.unit8_completed = TRUE) 
                   AND (OLD.unit8 IS DISTINCT FROM NEW.unit8 OR OLD.unit8_completed IS DISTINCT FROM NEW.unit8_completed) 
                   AND (NEW.unit8_updated_at IS NULL OR NEW.unit8_updated_at < (CURRENT_TIMESTAMP - INTERVAL '1 minute')) 
                THEN NEW.unit8_updated_at := CURRENT_TIMESTAMP; END IF;

                -- Unit 9
                IF (NEW.unit9 = 1 OR NEW.unit9 = 100 OR NEW.unit9_completed = TRUE) 
                   AND (OLD.unit9 IS DISTINCT FROM NEW.unit9 OR OLD.unit9_completed IS DISTINCT FROM NEW.unit9_completed) 
                   AND (NEW.unit9_updated_at IS NULL OR NEW.unit9_updated_at < (CURRENT_TIMESTAMP - INTERVAL '1 minute')) 
                THEN NEW.unit9_updated_at := CURRENT_TIMESTAMP; END IF;


                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        await client.query(`
            DROP TRIGGER IF EXISTS trg_update_unit_timestamp ON ph_schools;
            CREATE TRIGGER trg_update_unit_timestamp 
            BEFORE INSERT OR UPDATE ON ph_schools 
            FOR EACH ROW 
            EXECUTE FUNCTION update_unit_timestamp();
        `);

        console.log(`✅ [${dbLabel}] Unit Accomplishment Trigger is active.`);
    } catch (err) {
        console.error(`❌ [${dbLabel}] Failed to initialize timestamp trigger:`, err.message);
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
        // --- 0. UNIT SCHEMAS ---
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

        // --- 5. UNIT PROGRESS COLUMNS ---
        try {
            await client.query(`
            ALTER TABLE ph_schools 
            ADD COLUMN IF NOT EXISTS unit1 SMALLINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit2 SMALLINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit3 SMALLINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit4 SMALLINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit5 SMALLINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit6 SMALLINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit7 SMALLINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit8 SMALLINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit9 SMALLINT DEFAULT 0;
        `);
        } catch (colErr) {
            console.error(`❌ [${dbLabel}] Failed to add unit progress columns:`, colErr.message);
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
            ADD COLUMN IF NOT EXISTS is_esf7_opened             BOOLEAN DEFAULT FALSE,
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

            // ── UNIT 3: Organized Classes Table Initialization & Migration ────────
            await client.query(`
            CREATE TABLE IF NOT EXISTS unit3_organized_classes (
                iern TEXT PRIMARY KEY REFERENCES ph_schools(iern) ON DELETE CASCADE,
                school_id TEXT UNIQUE REFERENCES ph_schools(school_id) ON DELETE CASCADE,
                grade_kinder_size TEXT,
                grade_1_size TEXT,
                grade_2_size TEXT,
                grade_3_size TEXT,
                grade_4_size TEXT,
                grade_5_size TEXT,
                grade_6_size TEXT,
                grade_7_size TEXT,
                grade_8_size TEXT,
                grade_9_size TEXT,
                grade_10_size TEXT,
                grade_11_size TEXT,
                grade_12_size TEXT,
                multigrade_size_1 TEXT,
                multigrade_size_2 TEXT,
                multigrade_size_3 TEXT,
                unit3 BOOLEAN DEFAULT FALSE,
                unit3_completed NUMERIC(5,2) DEFAULT 0.00,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            `);

            // Migrate data if old columns exist on ph_schools
            const columnCheck = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'ph_schools' AND column_name = 'grade_kinder_size'
            `);

            if (columnCheck.rowCount > 0) {
                console.log("🚚 Migrating Unit 3 data from ph_schools to unit3_organized_classes...");
                
                // Drop columns from ph_schools
                console.log("🧹 Dropping deprecated Unit 3 columns from ph_schools...");
                await client.query(`
                    ALTER TABLE ph_schools
                    DROP COLUMN IF EXISTS has_multigrade CASCADE,
                    DROP COLUMN IF EXISTS multigrade_sections_count CASCADE,
                    DROP COLUMN IF EXISTS unit3_simplified_counts CASCADE,
                    DROP COLUMN IF EXISTS grade_kinder_size CASCADE,
                    DROP COLUMN IF EXISTS grade_1_size CASCADE,
                    DROP COLUMN IF EXISTS grade_2_size CASCADE,
                    DROP COLUMN IF EXISTS grade_3_size CASCADE,
                    DROP COLUMN IF EXISTS grade_4_size CASCADE,
                    DROP COLUMN IF EXISTS grade_5_size CASCADE,
                    DROP COLUMN IF EXISTS grade_6_size CASCADE,
                    DROP COLUMN IF EXISTS grade_7_size CASCADE,
                    DROP COLUMN IF EXISTS grade_8_size CASCADE,
                    DROP COLUMN IF EXISTS grade_9_size CASCADE,
                    DROP COLUMN IF EXISTS grade_10_size CASCADE,
                    DROP COLUMN IF EXISTS grade_11_size CASCADE,
                    DROP COLUMN IF EXISTS grade_12_size CASCADE,
                    DROP COLUMN IF EXISTS multigrade_size_1 CASCADE,
                    DROP COLUMN IF EXISTS multigrade_size_2 CASCADE,
                    DROP COLUMN IF EXISTS multigrade_size_3 CASCADE;
                `);
            }

            // ── UNIT 4: Learner Profile ──────────────────────────────────────────
            // ── UNIT 4: Learner Profile Table Initialization & Migration ────────
            await client.query(`
            CREATE TABLE IF NOT EXISTS unit4_learner_profile (
                iern TEXT PRIMARY KEY REFERENCES ph_schools(iern) ON DELETE CASCADE,
                school_id TEXT UNIQUE REFERENCES ph_schools(school_id) ON DELETE CASCADE,
                selected_learner_groups JSONB,
                bmi_severely_wasted INTEGER DEFAULT 0,
                bmi_wasted INTEGER DEFAULT 0,
                bmi_overweight_obese INTEGER DEFAULT 0,
                bmi_normal INTEGER DEFAULT 0,
                -- ALS
                als_kinder INTEGER DEFAULT 0, als_g1 INTEGER DEFAULT 0, als_g2 INTEGER DEFAULT 0, als_g3 INTEGER DEFAULT 0,
                als_g4 INTEGER DEFAULT 0, als_g5 INTEGER DEFAULT 0, als_g6 INTEGER DEFAULT 0, als_g7 INTEGER DEFAULT 0,
                als_g8 INTEGER DEFAULT 0, als_g9 INTEGER DEFAULT 0, als_g10 INTEGER DEFAULT 0, als_g11 INTEGER DEFAULT 0,
                als_g12 INTEGER DEFAULT 0, als_total INTEGER DEFAULT 0,
                -- 4Ps
                fourps_kinder INTEGER DEFAULT 0, fourps_g1 INTEGER DEFAULT 0, fourps_g2 INTEGER DEFAULT 0, fourps_g3 INTEGER DEFAULT 0,
                fourps_g4 INTEGER DEFAULT 0, fourps_g5 INTEGER DEFAULT 0, fourps_g6 INTEGER DEFAULT 0, fourps_g7 INTEGER DEFAULT 0,
                fourps_g8 INTEGER DEFAULT 0, fourps_g9 INTEGER DEFAULT 0, fourps_g10 INTEGER DEFAULT 0, fourps_g11 INTEGER DEFAULT 0,
                fourps_g12 INTEGER DEFAULT 0,
                -- Muslim
                muslim_kinder INTEGER DEFAULT 0, muslim_g1 INTEGER DEFAULT 0, muslim_g2 INTEGER DEFAULT 0, muslim_g3 INTEGER DEFAULT 0,
                muslim_g4 INTEGER DEFAULT 0, muslim_g5 INTEGER DEFAULT 0, muslim_g6 INTEGER DEFAULT 0, muslim_g7 INTEGER DEFAULT 0,
                muslim_g8 INTEGER DEFAULT 0, muslim_g9 INTEGER DEFAULT 0, muslim_g10 INTEGER DEFAULT 0, muslim_g11 INTEGER DEFAULT 0,
                muslim_g12 INTEGER DEFAULT 0,
                -- IP
                ip_kinder INTEGER DEFAULT 0, ip_g1 INTEGER DEFAULT 0, ip_g2 INTEGER DEFAULT 0, ip_g3 INTEGER DEFAULT 0,
                ip_g4 INTEGER DEFAULT 0, ip_g5 INTEGER DEFAULT 0, ip_g6 INTEGER DEFAULT 0, ip_g7 INTEGER DEFAULT 0,
                ip_g8 INTEGER DEFAULT 0, ip_g9 INTEGER DEFAULT 0, ip_g10 INTEGER DEFAULT 0, ip_g11 INTEGER DEFAULT 0,
                ip_g12 INTEGER DEFAULT 0,
                -- Displaced
                displaced_kinder INTEGER DEFAULT 0, displaced_g1 INTEGER DEFAULT 0, displaced_g2 INTEGER DEFAULT 0, displaced_g3 INTEGER DEFAULT 0,
                displaced_g4 INTEGER DEFAULT 0, displaced_g5 INTEGER DEFAULT 0, displaced_g6 INTEGER DEFAULT 0, displaced_g7 INTEGER DEFAULT 0,
                displaced_g8 INTEGER DEFAULT 0, displaced_g9 INTEGER DEFAULT 0, displaced_g10 INTEGER DEFAULT 0, displaced_g11 INTEGER DEFAULT 0,
                displaced_g12 INTEGER DEFAULT 0,
                -- Overage
                overage_kinder INTEGER DEFAULT 0, overage_g1 INTEGER DEFAULT 0, overage_g2 INTEGER DEFAULT 0, overage_g3 INTEGER DEFAULT 0,
                overage_g4 INTEGER DEFAULT 0, overage_g5 INTEGER DEFAULT 0, overage_g6 INTEGER DEFAULT 0, overage_g7 INTEGER DEFAULT 0,
                overage_g8 INTEGER DEFAULT 0, overage_g9 INTEGER DEFAULT 0, overage_g10 INTEGER DEFAULT 0, overage_g11 INTEGER DEFAULT 0,
                overage_g12 INTEGER DEFAULT 0,
                -- Dropout
                dropout_kinder INTEGER DEFAULT 0, dropout_g1 INTEGER DEFAULT 0, dropout_g2 INTEGER DEFAULT 0, dropout_g3 INTEGER DEFAULT 0,
                dropout_g4 INTEGER DEFAULT 0, dropout_g5 INTEGER DEFAULT 0, dropout_g6 INTEGER DEFAULT 0, dropout_g7 INTEGER DEFAULT 0,
                dropout_g8 INTEGER DEFAULT 0, dropout_g9 INTEGER DEFAULT 0, dropout_g10 INTEGER DEFAULT 0, dropout_g11 INTEGER DEFAULT 0,
                dropout_g12 INTEGER DEFAULT 0,
                -- Repeater
                repeater_kinder INTEGER DEFAULT 0, repeater_g1 INTEGER DEFAULT 0, repeater_g2 INTEGER DEFAULT 0, repeater_g3 INTEGER DEFAULT 0,
                repeater_g4 INTEGER DEFAULT 0, repeater_g5 INTEGER DEFAULT 0, repeater_g6 INTEGER DEFAULT 0, repeater_g7 INTEGER DEFAULT 0,
                repeater_g8 INTEGER DEFAULT 0, repeater_g9 INTEGER DEFAULT 0, repeater_g10 INTEGER DEFAULT 0, repeater_g11 INTEGER DEFAULT 0,
                repeater_g12 INTEGER DEFAULT 0,
                -- LWD
                lwd_kinder INTEGER DEFAULT 0, lwd_g1 INTEGER DEFAULT 0, lwd_g2 INTEGER DEFAULT 0, lwd_g3 INTEGER DEFAULT 0,
                lwd_g4 INTEGER DEFAULT 0, lwd_g5 INTEGER DEFAULT 0, lwd_g6 INTEGER DEFAULT 0, lwd_g7 INTEGER DEFAULT 0,
                lwd_g8 INTEGER DEFAULT 0, lwd_g9 INTEGER DEFAULT 0, lwd_g10 INTEGER DEFAULT 0, lwd_g11 INTEGER DEFAULT 0,
                lwd_g12 INTEGER DEFAULT 0,
                -- SNED per grade
                sned_kinder INTEGER DEFAULT 0, sned_g1 INTEGER DEFAULT 0, sned_g2 INTEGER DEFAULT 0, sned_g3 INTEGER DEFAULT 0,
                sned_g4 INTEGER DEFAULT 0, sned_g5 INTEGER DEFAULT 0, sned_g6 INTEGER DEFAULT 0, sned_g7 INTEGER DEFAULT 0,
                sned_g8 INTEGER DEFAULT 0, sned_g9 INTEGER DEFAULT 0, sned_g10 INTEGER DEFAULT 0, sned_g11 INTEGER DEFAULT 0,
                sned_g12 INTEGER DEFAULT 0,
                unit4 BOOLEAN DEFAULT FALSE,
                unit4_completed NUMERIC(5,2) DEFAULT 0.00,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            `);

            await client.query(`
                ALTER TABLE unit4_learner_profile
                ADD COLUMN IF NOT EXISTS fourps_kinder INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS fourps_g1 INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS fourps_g2 INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS fourps_g3 INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS fourps_g4 INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS fourps_g5 INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS fourps_g6 INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS fourps_g7 INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS fourps_g8 INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS fourps_g9 INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS fourps_g10 INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS fourps_g11 INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS fourps_g12 INTEGER DEFAULT 0;
            `).catch(() => {});

            // Migrate data if old columns exist on ph_schools
            const columnCheckUnit4 = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'ph_schools' AND column_name = 'bmi_severely_wasted'
            `);

            if (columnCheckUnit4.rowCount > 0) {
                console.log("🧹 Dropping deprecated Unit 4 columns from ph_schools...");
                await client.query(`
                    ALTER TABLE ph_schools
                    DROP COLUMN IF EXISTS selected_learner_groups CASCADE,
                    DROP COLUMN IF EXISTS bmi_severely_wasted CASCADE,
                    DROP COLUMN IF EXISTS bmi_wasted CASCADE,
                    DROP COLUMN IF EXISTS bmi_overweight_obese CASCADE,
                    DROP COLUMN IF EXISTS bmi_normal CASCADE,
                    DROP COLUMN IF EXISTS als_kinder CASCADE, DROP COLUMN IF EXISTS als_g1 CASCADE, DROP COLUMN IF EXISTS als_g2 CASCADE, DROP COLUMN IF EXISTS als_g3 CASCADE, DROP COLUMN IF EXISTS als_g4 CASCADE, DROP COLUMN IF EXISTS als_g5 CASCADE, DROP COLUMN IF EXISTS als_g6 CASCADE, DROP COLUMN IF EXISTS als_g7 CASCADE, DROP COLUMN IF EXISTS als_g8 CASCADE, DROP COLUMN IF EXISTS als_g9 CASCADE, DROP COLUMN IF EXISTS als_g10 CASCADE, DROP COLUMN IF EXISTS als_g11 CASCADE, DROP COLUMN IF EXISTS als_g12 CASCADE, DROP COLUMN IF EXISTS als_total CASCADE,
                    DROP COLUMN IF EXISTS muslim_kinder CASCADE, DROP COLUMN IF EXISTS muslim_g1 CASCADE, DROP COLUMN IF EXISTS muslim_g2 CASCADE, DROP COLUMN IF EXISTS muslim_g3 CASCADE, DROP COLUMN IF EXISTS muslim_g4 CASCADE, DROP COLUMN IF EXISTS muslim_g5 CASCADE, DROP COLUMN IF EXISTS muslim_g6 CASCADE, DROP COLUMN IF EXISTS muslim_g7 CASCADE, DROP COLUMN IF EXISTS muslim_g8 CASCADE, DROP COLUMN IF EXISTS muslim_g9 CASCADE, DROP COLUMN IF EXISTS muslim_g10 CASCADE, DROP COLUMN IF EXISTS muslim_g11 CASCADE, DROP COLUMN IF EXISTS muslim_g12 CASCADE,
                    DROP COLUMN IF EXISTS ip_kinder CASCADE, DROP COLUMN IF EXISTS ip_g1 CASCADE, DROP COLUMN IF EXISTS ip_g2 CASCADE, DROP COLUMN IF EXISTS ip_g3 CASCADE, DROP COLUMN IF EXISTS ip_g4 CASCADE, DROP COLUMN IF EXISTS ip_g5 CASCADE, DROP COLUMN IF EXISTS ip_g6 CASCADE, DROP COLUMN IF EXISTS ip_g7 CASCADE, DROP COLUMN IF EXISTS ip_g8 CASCADE, DROP COLUMN IF EXISTS ip_g9 CASCADE, DROP COLUMN IF EXISTS ip_g10 CASCADE, DROP COLUMN IF EXISTS ip_g11 CASCADE, DROP COLUMN IF EXISTS ip_g12 CASCADE,
                    DROP COLUMN IF EXISTS displaced_kinder CASCADE, DROP COLUMN IF EXISTS displaced_g1 CASCADE, DROP COLUMN IF EXISTS displaced_g2 CASCADE, DROP COLUMN IF EXISTS displaced_g3 CASCADE, DROP COLUMN IF EXISTS displaced_g4 CASCADE, DROP COLUMN IF EXISTS displaced_g5 CASCADE, DROP COLUMN IF EXISTS displaced_g6 CASCADE, DROP COLUMN IF EXISTS displaced_g7 CASCADE, DROP COLUMN IF EXISTS displaced_g8 CASCADE, DROP COLUMN IF EXISTS displaced_g9 CASCADE, DROP COLUMN IF EXISTS displaced_g10 CASCADE, DROP COLUMN IF EXISTS displaced_g11 CASCADE, DROP COLUMN IF EXISTS displaced_g12 CASCADE,
                    DROP COLUMN IF EXISTS overage_kinder CASCADE, DROP COLUMN IF EXISTS overage_g1 CASCADE, DROP COLUMN IF EXISTS overage_g2 CASCADE, DROP COLUMN IF EXISTS overage_g3 CASCADE, DROP COLUMN IF EXISTS overage_g4 CASCADE, DROP COLUMN IF EXISTS overage_g5 CASCADE, DROP COLUMN IF EXISTS overage_g6 CASCADE, DROP COLUMN IF EXISTS overage_g7 CASCADE, DROP COLUMN IF EXISTS overage_g8 CASCADE, DROP COLUMN IF EXISTS overage_g9 CASCADE, DROP COLUMN IF EXISTS overage_g10 CASCADE, DROP COLUMN IF EXISTS overage_g11 CASCADE, DROP COLUMN IF EXISTS overage_g12 CASCADE,
                    DROP COLUMN IF EXISTS dropout_kinder CASCADE, DROP COLUMN IF EXISTS dropout_g1 CASCADE, DROP COLUMN IF EXISTS dropout_g2 CASCADE, DROP COLUMN IF EXISTS dropout_g3 CASCADE, DROP COLUMN IF EXISTS dropout_g4 CASCADE, DROP COLUMN IF EXISTS dropout_g5 CASCADE, DROP COLUMN IF EXISTS dropout_g6 CASCADE, DROP COLUMN IF EXISTS dropout_g7 CASCADE, DROP COLUMN IF EXISTS dropout_g8 CASCADE, DROP COLUMN IF EXISTS dropout_g9 CASCADE, DROP COLUMN IF EXISTS dropout_g10 CASCADE, DROP COLUMN IF EXISTS dropout_g11 CASCADE, DROP COLUMN IF EXISTS dropout_g12 CASCADE,
                    DROP COLUMN IF EXISTS repeater_kinder CASCADE, DROP COLUMN IF EXISTS repeater_g1 CASCADE, DROP COLUMN IF EXISTS repeater_g2 CASCADE, DROP COLUMN IF EXISTS repeater_g3 CASCADE, DROP COLUMN IF EXISTS repeater_g4 CASCADE, DROP COLUMN IF EXISTS repeater_g5 CASCADE, DROP COLUMN IF EXISTS repeater_g6 CASCADE, DROP COLUMN IF EXISTS repeater_g7 CASCADE, DROP COLUMN IF EXISTS repeater_g8 CASCADE, DROP COLUMN IF EXISTS repeater_g9 CASCADE, DROP COLUMN IF EXISTS repeater_g10 CASCADE, DROP COLUMN IF EXISTS repeater_g11 CASCADE, DROP COLUMN IF EXISTS repeater_g12 CASCADE,
                    DROP COLUMN IF EXISTS lwd_kinder CASCADE, DROP COLUMN IF EXISTS lwd_g1 CASCADE, DROP COLUMN IF EXISTS lwd_g2 CASCADE, DROP COLUMN IF EXISTS lwd_g3 CASCADE, DROP COLUMN IF EXISTS lwd_g4 CASCADE, DROP COLUMN IF EXISTS lwd_g5 CASCADE, DROP COLUMN IF EXISTS lwd_g6 CASCADE, DROP COLUMN IF EXISTS lwd_g7 CASCADE, DROP COLUMN IF EXISTS lwd_g8 CASCADE, DROP COLUMN IF EXISTS lwd_g9 CASCADE, DROP COLUMN IF EXISTS lwd_g10 CASCADE, DROP COLUMN IF EXISTS lwd_g11 CASCADE, DROP COLUMN IF EXISTS lwd_g12 CASCADE,
                    DROP COLUMN IF EXISTS sned_kinder CASCADE, DROP COLUMN IF EXISTS sned_g1 CASCADE, DROP COLUMN IF EXISTS sned_g2 CASCADE, DROP COLUMN IF EXISTS sned_g3 CASCADE, DROP COLUMN IF EXISTS sned_g4 CASCADE, DROP COLUMN IF EXISTS sned_g5 CASCADE, DROP COLUMN IF EXISTS sned_g6 CASCADE, DROP COLUMN IF EXISTS sned_g7 CASCADE, DROP COLUMN IF EXISTS sned_g8 CASCADE, DROP COLUMN IF EXISTS sned_g9 CASCADE, DROP COLUMN IF EXISTS sned_g10 CASCADE, DROP COLUMN IF EXISTS sned_g11 CASCADE, DROP COLUMN IF EXISTS sned_g12 CASCADE,
                    DROP COLUMN IF EXISTS unit4 CASCADE,
                    DROP COLUMN IF EXISTS unit4_completed CASCADE,
                    DROP COLUMN IF EXISTS unit4_updated_at CASCADE;
                `);
            }

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
            ADD COLUMN IF NOT EXISTS u7_confirm_no_space        BOOLEAN DEFAULT FALSE,
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

            -- Unit 7 Master Columns (Mapping for Physical Facilities)
            ADD COLUMN IF NOT EXISTS unit7_data                 JSONB,
            ADD COLUMN IF NOT EXISTS unit7_rooms                JSONB,
            ADD COLUMN IF NOT EXISTS unit7_repair               JSONB,
            ADD COLUMN IF NOT EXISTS unit7_demolition           JSONB,
            ADD COLUMN IF NOT EXISTS unit7_spaces               JSONB,
            ADD COLUMN IF NOT EXISTS has_no_building            BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS build_classrooms_total     INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS build_classrooms_new       INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS build_classrooms_good      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS build_classrooms_repair    INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS build_classrooms_demolition INTEGER DEFAULT 0,

            ADD COLUMN IF NOT EXISTS unit8                      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit8_completed            BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS unit8_updated_at           TIMESTAMPTZ;
        `);

            // ── UNIT 9: Infrastructure & Safety Audit ─────────────────────────────
            await client.query(`
            ALTER TABLE ph_schools
            ADD COLUMN IF NOT EXISTS hazard_risk_score          INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_general                 TEXT,
            ADD COLUMN IF NOT EXISTS u9_wiring                  TEXT,
            ADD COLUMN IF NOT EXISTS u9_cords_cctv              TEXT,
            ADD COLUMN IF NOT EXISTS u9_final                   TEXT,
            ADD COLUMN IF NOT EXISTS u9_fire_exit_exists        BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS u9_backup_light_exists     BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS u9_ecart_load_ready        BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS u9_has_surge_protection    BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS u9_remarks                 TEXT,
            
            -- Security Inventory
            ADD COLUMN IF NOT EXISTS u9_cctv_working            INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_cctv_broken             INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_cctv_spares             INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_fire_ext_working        INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_fire_ext_broken         INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_fire_ext_spares         INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_first_aid_working       INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_first_aid_broken        INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_first_aid_spares        INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_bullhorns_working       INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_bullhorns_broken        INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_bullhorns_spares        INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_radios_working          INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_radios_broken           INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_radios_spares           INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_flashlight_working      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_flashlight_broken       INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_flashlight_spares       INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_whistles_quantity       INTEGER DEFAULT 0,

            -- Electrical Inventory
            ADD COLUMN IF NOT EXISTS u9_bulbs_working           INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_bulbs_broken            INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_bulbs_spares            INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_covers_working          INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_covers_broken           INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_covers_spares           INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_breakers_working        INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_breakers_broken         INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_breakers_spares         INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_ext_cords_working       INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_ext_cords_broken        INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_ext_cords_spares        INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS u9_tape_quantity           INTEGER DEFAULT 0,

            ADD COLUMN IF NOT EXISTS unit9                      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS unit9_completed            BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS unit9_updated_at           TIMESTAMPTZ;
        `);


            // ── MONITORING / COMPLETION SNAPSHOT ─────────────────────────────────
            await client.query(`
            ALTER TABLE ph_schools
            ADD COLUMN IF NOT EXISTS unit_completion            NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS forms_completed_count      INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS completion_percentage      NUMERIC DEFAULT 0;
        `);

            // ── INDEXES ───────────────────────────────────────────────────────────
            await client.query(`DROP INDEX IF EXISTS idx_ph_schools_school_id;`).catch(() => {});
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

        // --- 21c. UNIT 1 SCHOOL IDENTITY TABLE ---
        try {
            await client.query(`
            CREATE TABLE IF NOT EXISTS unit1_school_identity (
                iern TEXT PRIMARY KEY REFERENCES ph_schools(iern) ON DELETE CASCADE,
                school_id TEXT UNIQUE,
                school_name TEXT,
                region TEXT,
                province TEXT,
                municipality TEXT,
                barangay TEXT,
                division TEXT,
                district TEXT,
                leg_district TEXT,
                curricular_offering TEXT,
                latitude TEXT,
                longitude TEXT,
                school_type TEXT,
                mother_school_id TEXT,
                extension_mother_school_name TEXT,
                established_month TEXT,
                established_year TEXT,
                head_first_name TEXT,
                head_middle_name TEXT,
                head_last_name TEXT,
                head_sex TEXT,
                head_position_title TEXT,
                head_date_hired TEXT,
                ownership_na_reason TEXT,
                ownership_doc_id INTEGER REFERENCES school_ownership_docs(id) ON DELETE SET NULL,
                ownership_type TEXT,
                document_type TEXT,
                multiple_ownership JSONB,
                multiple_document_type JSONB,
                document_path TEXT,
                annexes JSONB,
                unit1 INTEGER DEFAULT 0,
                unit1_completed BOOLEAN DEFAULT FALSE,
                unit1_updated_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            `);
            console.log(`✅ [${dbLabel}] Unit 1 School Identity Table Initialized`);
        } catch (u1Err) {
            console.error(`❌ [${dbLabel}] Failed to init unit1_school_identity table:`, u1Err.message);
        }

        // --- 21d. UNIT 2 SCHOOL LEARNERS TABLE ---
        try {

            await client.query(`
            CREATE TABLE IF NOT EXISTS unit2_school_learners (
                iern TEXT PRIMARY KEY REFERENCES ph_schools(iern) ON DELETE CASCADE,
                school_id TEXT UNIQUE REFERENCES ph_schools(school_id) ON DELETE CASCADE,
                enroll_kinder INTEGER DEFAULT 0,
                enroll_g1 INTEGER DEFAULT 0,
                enroll_g2 INTEGER DEFAULT 0,
                enroll_g3 INTEGER DEFAULT 0,
                enroll_g4 INTEGER DEFAULT 0,
                enroll_g5 INTEGER DEFAULT 0,
                enroll_g6 INTEGER DEFAULT 0,
                enroll_g7 INTEGER DEFAULT 0,
                enroll_g8 INTEGER DEFAULT 0,
                enroll_g9 INTEGER DEFAULT 0,
                enroll_g10 INTEGER DEFAULT 0,
                enroll_g11 INTEGER DEFAULT 0,
                enroll_g12 INTEGER DEFAULT 0,
                total_enrollment INTEGER DEFAULT 0,
                male_enrollment INTEGER DEFAULT 0,
                female_enrollment INTEGER DEFAULT 0,
                total_male INTEGER DEFAULT 0,
                total_female INTEGER DEFAULT 0,
                kinder_male INTEGER DEFAULT 0, kinder_female INTEGER DEFAULT 0,
                g1_male INTEGER DEFAULT 0, g1_female INTEGER DEFAULT 0,
                g2_male INTEGER DEFAULT 0, g2_female INTEGER DEFAULT 0,
                g3_male INTEGER DEFAULT 0, g3_female INTEGER DEFAULT 0,
                g4_male INTEGER DEFAULT 0, g4_female INTEGER DEFAULT 0,
                g5_male INTEGER DEFAULT 0, g5_female INTEGER DEFAULT 0,
                g6_male INTEGER DEFAULT 0, g6_female INTEGER DEFAULT 0,
                g7_male INTEGER DEFAULT 0, g7_female INTEGER DEFAULT 0,
                g8_male INTEGER DEFAULT 0, g8_female INTEGER DEFAULT 0,
                g9_male INTEGER DEFAULT 0, g9_female INTEGER DEFAULT 0,
                g10_male INTEGER DEFAULT 0, g10_female INTEGER DEFAULT 0,
                g11_male INTEGER DEFAULT 0, g11_female INTEGER DEFAULT 0,
                g12_male INTEGER DEFAULT 0, g12_female INTEGER DEFAULT 0,
                
                -- SNED Demographic columns
                main_sned INTEGER DEFAULT 0,
                main_sned_male INTEGER DEFAULT 0,
                main_sned_female INTEGER DEFAULT 0,
                self_sned INTEGER DEFAULT 0,
                self_sned_male INTEGER DEFAULT 0,
                self_sned_female INTEGER DEFAULT 0,
                self_sned_org_class INTEGER DEFAULT 0,
                
                -- ARAL Program columns (flattened)
                has_aral_math BOOLEAN DEFAULT FALSE,
                aral_math_learners_g1 INTEGER DEFAULT 0,
                aral_math_learners_g2 INTEGER DEFAULT 0,
                aral_math_learners_g3 INTEGER DEFAULT 0,
                aral_math_learners_g4 INTEGER DEFAULT 0,
                aral_math_learners_g5 INTEGER DEFAULT 0,
                aral_math_learners_g6 INTEGER DEFAULT 0,
                
                has_aral_reading BOOLEAN DEFAULT FALSE,
                aral_reading_learners_g1 INTEGER DEFAULT 0,
                aral_reading_learners_g2 INTEGER DEFAULT 0,
                aral_reading_learners_g3 INTEGER DEFAULT 0,
                aral_reading_learners_g4 INTEGER DEFAULT 0,
                aral_reading_learners_g5 INTEGER DEFAULT 0,
                aral_reading_learners_g6 INTEGER DEFAULT 0,
                
                has_aral_science BOOLEAN DEFAULT FALSE,
                aral_science_learners_g1 INTEGER DEFAULT 0,
                aral_science_learners_g2 INTEGER DEFAULT 0,
                aral_science_learners_g3 INTEGER DEFAULT 0,
                aral_science_learners_g4 INTEGER DEFAULT 0,
                aral_science_learners_g5 INTEGER DEFAULT 0,
                aral_science_learners_g6 INTEGER DEFAULT 0,

                multigrade_groupings_1 TEXT,
                multigrade_groupings_2 TEXT,
                multigrade_groupings_3 TEXT,
                multigrade_enrollment_1 INTEGER DEFAULT 0,
                multigrade_enrollment_2 INTEGER DEFAULT 0,
                multigrade_enrollment_3 INTEGER DEFAULT 0,
                multigrade_groupings_1_male INTEGER DEFAULT 0,
                multigrade_groupings_1_female INTEGER DEFAULT 0,
                multigrade_groupings_2_male INTEGER DEFAULT 0,
                multigrade_groupings_2_female INTEGER DEFAULT 0,
                multigrade_groupings_3_male INTEGER DEFAULT 0,
                multigrade_groupings_3_female INTEGER DEFAULT 0,
                unit2 BOOLEAN DEFAULT FALSE,
                unit2_completed NUMERIC(5,2) DEFAULT 0.00,
                unit_2_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            `);
            console.log(`✅ [${dbLabel}] Unit 2 School Learners Table Initialized`);

            // Migration insert disabled to allow clean input from scratch
            console.log(`✅ [${dbLabel}] Unit 2 School Learners Table Initialized`);
        } catch (u2Err) {
            console.error(`❌ [${dbLabel}] Failed to init or migrate unit2_school_learners table:`, u2Err.message);
        }

        // --- 21f. UNIT 5 SHIFTING & MODALITY TABLE ---
        try {
            await client.query(`
            CREATE TABLE IF NOT EXISTS unit5_shifting_modality (
                iern TEXT PRIMARY KEY REFERENCES ph_schools(iern) ON DELETE CASCADE,
                school_id TEXT UNIQUE REFERENCES ph_schools(school_id) ON DELETE CASCADE,
                has_standard_shifting BOOLEAN DEFAULT FALSE,
                has_adms BOOLEAN DEFAULT FALSE,
                shifting_modality TEXT,
                adm_mdl BOOLEAN DEFAULT FALSE,
                adm_odl BOOLEAN DEFAULT FALSE,
                adm_tvi BOOLEAN DEFAULT FALSE,
                adm_blended BOOLEAN DEFAULT FALSE,
                shift_kinder TEXT, shift_g1 TEXT, shift_g2 TEXT, shift_g3 TEXT, shift_g4 TEXT, shift_g5 TEXT, shift_g6 TEXT,
                shift_g7 TEXT, shift_g8 TEXT, shift_g9 TEXT, shift_g10 TEXT, shift_g11 TEXT, shift_g12 TEXT,
                shift_mg_1 TEXT, shift_mg_2 TEXT, shift_mg_3 TEXT,
                mode_kinder TEXT, mode_g1 TEXT, mode_g2 TEXT, mode_g3 TEXT, mode_g4 TEXT, mode_g5 TEXT, mode_g6 TEXT,
                mode_g7 TEXT, mode_g8 TEXT, mode_g9 TEXT, mode_g10 TEXT, mode_g11 TEXT, mode_g12 TEXT,
                mode_mg_1 TEXT, mode_mg_2 TEXT, mode_mg_3 TEXT,
                unit5 INTEGER DEFAULT 0,
                unit5_completed BOOLEAN DEFAULT FALSE,
                unit5_updated_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            `);
            console.log(`✅ [${dbLabel}] Unit 5 Shifting & Modality Table Initialized`);
        } catch (u5Err) {
            console.error(`❌ [${dbLabel}] Failed to init unit5_shifting_modality table:`, u5Err.message);
        }

        // --- 21g. UNIT 6 SCHOOL RESOURCES TABLES ---
        try {
            await client.query(`
            CREATE TABLE IF NOT EXISTS unit6_school_resources (
                iern TEXT PRIMARY KEY REFERENCES ph_schools(iern) ON DELETE CASCADE,
                school_id TEXT UNIQUE REFERENCES ph_schools(school_id) ON DELETE CASCADE,
                iern_val TEXT,
                unit6_completed BOOLEAN DEFAULT FALSE,
                unit6_updated_at TIMESTAMPTZ,
                -- Seating / Furniture (General stats)
                has_general_rooms BOOLEAN DEFAULT FALSE,
                general_rooms_count INTEGER DEFAULT 0,
                armchair_wood_func INTEGER DEFAULT 0, armchair_wood_broken INTEGER DEFAULT 0,
                armchair_plastic_func INTEGER DEFAULT 0, armchair_plastic_broken INTEGER DEFAULT 0,
                armchair_plastic_steel_func INTEGER DEFAULT 0, armchair_plastic_steel_broken INTEGER DEFAULT 0,
                individual_table_chair_func INTEGER DEFAULT 0, individual_table_chair_broken INTEGER DEFAULT 0,
                two_seater_wood_func INTEGER DEFAULT 0, two_seater_wood_broken INTEGER DEFAULT 0,
                two_seater_wood_steel_func INTEGER DEFAULT 0, two_seater_wood_steel_broken INTEGER DEFAULT 0,
                wooden_chair_only_func INTEGER DEFAULT 0, wooden_chair_only_broken INTEGER DEFAULT 0,
                plastic_chair_only_func INTEGER DEFAULT 0, plastic_chair_only_broken INTEGER DEFAULT 0,
                has_teacher_desk BOOLEAN DEFAULT FALSE,
                -- ICT (Main stats)
                laptops_total INTEGER DEFAULT 0, laptops_func INTEGER DEFAULT 0, laptops_teaching INTEGER DEFAULT 0, laptops_working INTEGER DEFAULT 0, laptops_students INTEGER DEFAULT 0,
                tablets_total INTEGER DEFAULT 0, tablets_func INTEGER DEFAULT 0, tablets_teaching INTEGER DEFAULT 0, tablets_working INTEGER DEFAULT 0, tablets_students INTEGER DEFAULT 0,
                desktops_total INTEGER DEFAULT 0, desktops_func INTEGER DEFAULT 0, desktops_teaching INTEGER DEFAULT 0, desktops_working INTEGER DEFAULT 0, desktops_students INTEGER DEFAULT 0,
                smart_tvs_total INTEGER DEFAULT 0, smart_tvs_func INTEGER DEFAULT 0, smart_tvs_cond TEXT,
                projectors_total INTEGER DEFAULT 0, projectors_func INTEGER DEFAULT 0, projectors_cond TEXT,
                printers_total INTEGER DEFAULT 0, printers_func INTEGER DEFAULT 0, printers_cond TEXT,
                unit7_has_ecart BOOLEAN DEFAULT FALSE,
                -- WASH (Toilet & sanitation stats)
                male_seats_total INTEGER DEFAULT 0, male_seats_func INTEGER DEFAULT 0, male_seats_cond TEXT,
                male_urinals_total INTEGER DEFAULT 0, male_urinals_func INTEGER DEFAULT 0,
                female_seats_total INTEGER DEFAULT 0, female_seats_func INTEGER DEFAULT 0, female_seats_cond TEXT,
                common_seats_total INTEGER DEFAULT 0, common_seats_func INTEGER DEFAULT 0, common_seats_cond TEXT,
                pwd_seats_total INTEGER DEFAULT 0, pwd_seats_func INTEGER DEFAULT 0, pwd_seats_cond TEXT,
                faucets_total INTEGER DEFAULT 0, faucets_func INTEGER DEFAULT 0, faucets_cond TEXT,
                water_source TEXT,
                confirm_no_piped BOOLEAN DEFAULT FALSE,
                confirm_no_piped_text TEXT,
                confirm_zero_wash_text TEXT,
                attached_cr_classrooms INTEGER DEFAULT 0,
                attached_cr_seats INTEGER DEFAULT 0,
                attached_cr_included_in_main BOOLEAN DEFAULT FALSE,
                -- Utilities
                utility_electricity TEXT,
                confirm_no_grid BOOLEAN DEFAULT FALSE,
                confirm_no_grid_text TEXT,
                has_solar_or_gen BOOLEAN DEFAULT FALSE,
                utility_internet_yesno TEXT,
                utility_internet_type TEXT,
                confirm_no_wired BOOLEAN DEFAULT FALSE,
                confirm_no_wired_text TEXT,
                utility_internet_funder TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            `);

            // Idempotent column additions for Unit 6 Student allocation fields
            await client.query(`
            ALTER TABLE unit6_school_resources 
            ADD COLUMN IF NOT EXISTS laptops_students INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS tablets_students INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS desktops_students INTEGER DEFAULT 0;
            `).catch(e => console.warn(`⚠️ [${dbLabel}] unit6_school_resources alter failed:`, e.message));

            await client.query(`
            CREATE TABLE IF NOT EXISTS unit6_furniture_grades (
                id SERIAL PRIMARY KEY,
                iern TEXT REFERENCES ph_schools(iern) ON DELETE CASCADE,
                grade_level TEXT NOT NULL,
                armchair_wood_func INTEGER DEFAULT 0, armchair_wood_broken INTEGER DEFAULT 0,
                armchair_plastic_func INTEGER DEFAULT 0, armchair_plastic_broken INTEGER DEFAULT 0,
                armchair_plastic_steel_func INTEGER DEFAULT 0, armchair_plastic_steel_broken INTEGER DEFAULT 0,
                individual_table_chair_func INTEGER DEFAULT 0, individual_table_chair_broken INTEGER DEFAULT 0,
                two_seater_wood_func INTEGER DEFAULT 0, two_seater_wood_broken INTEGER DEFAULT 0,
                two_seater_wood_steel_func INTEGER DEFAULT 0, two_seater_wood_steel_broken INTEGER DEFAULT 0,
                wooden_chair_only_func INTEGER DEFAULT 0, wooden_chair_only_broken INTEGER DEFAULT 0,
                plastic_chair_only_func INTEGER DEFAULT 0, plastic_chair_only_broken INTEGER DEFAULT 0,
                is_sharing BOOLEAN DEFAULT FALSE,
                shared_with TEXT,
                is_kinder_double_shift BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            `);
            await client.query(`
            CREATE TABLE IF NOT EXISTS unit6_ecart_batches (
                id SERIAL PRIMARY KEY,
                iern TEXT REFERENCES ph_schools(iern) ON DELETE CASCADE,
                batches_name TEXT,
                year_received INTEGER DEFAULT 0,
                sources_fund TEXT,
                ecart_laptops INTEGER DEFAULT 0,
                ecart_tablets INTEGER DEFAULT 0,
                ecart_tv INTEGER DEFAULT 0,
                charging_condition TEXT,
                remarks TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            `);
            console.log(`✅ [${dbLabel}] Unit 6 Relational Tables Initialized`);
        } catch (u6Err) {
            console.error(`❌ [${dbLabel}] Failed to init unit6 tables:`, u6Err.message);
        }

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
                excluded_tables TEXT[] := ARRAY['ph_buildings_inventory', 'ph_buildings_repairs', 'ph_buildings_demolition', 'ph_school_buildable_spaces', 'school_ownership_docs', 'school_location_profiles', 'unit8_location', 'unit9_safety', 'buildable_spaces', 'unit6_furniture_grades', 'unit6_ecart_batches'];
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

export { initOtpTable, runMigrations };
