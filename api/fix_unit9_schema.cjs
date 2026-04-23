const pg = require('pg');
const pool = new pg.Pool({ 
    connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: { rejectUnauthorized: false }
});

async function fix() {
    console.log("🛠️ Starting Unit 9 Schema Repair...");
    const cols = [
        ['u9_cctv_working', 'INTEGER'], ['u9_cctv_broken', 'INTEGER'], ['u9_cctv_spares', 'INTEGER'],
        ['u9_fire_ext_working', 'INTEGER'], ['u9_fire_ext_broken', 'INTEGER'], ['u9_fire_ext_spares', 'INTEGER'],
        ['u9_first_aid_working', 'INTEGER'], ['u9_first_aid_broken', 'INTEGER'], ['u9_first_aid_spares', 'INTEGER'],
        ['u9_bullhorns_working', 'INTEGER'], ['u9_bullhorns_broken', 'INTEGER'], ['u9_bullhorns_spares', 'INTEGER'],
        ['u9_radios_working', 'INTEGER'], ['u9_radios_broken', 'INTEGER'], ['u9_radios_spares', 'INTEGER'],
        ['u9_flashlight_working', 'INTEGER'], ['u9_flashlight_broken', 'INTEGER'], ['u9_flashlight_spares', 'INTEGER'],
        ['u9_whistles_quantity', 'INTEGER'], ['u9_bulbs_working', 'INTEGER'], ['u9_bulbs_broken', 'INTEGER'],
        ['u9_bulbs_spares', 'INTEGER'], ['u9_covers_working', 'INTEGER'], ['u9_covers_broken', 'INTEGER'],
        ['u9_covers_spares', 'INTEGER'], ['u9_breakers_working', 'INTEGER'], ['u9_breakers_broken', 'INTEGER'],
        ['u9_breakers_spares', 'INTEGER'], ['u9_ext_cords_working', 'INTEGER'], ['u9_ext_cords_broken', 'INTEGER'],
        ['u9_ext_cords_spares', 'INTEGER'], ['u9_tape_quantity', 'INTEGER'], ['u9_fire_exit_exists', 'INTEGER'],
        ['u9_backup_light_exists', 'INTEGER'], ['u9_ecart_load_ready', 'INTEGER'], ['u9_has_surge_protection', 'INTEGER'],
        ['u9_remarks', 'TEXT']
    ];

    for (const [name, type] of cols) {
        try {
            const defVal = (type === 'TEXT' ? 'NULL' : '0');
            await pool.query(`ALTER TABLE ph_schools_audit ADD COLUMN IF NOT EXISTS ${name} ${type} DEFAULT ${defVal}`);
            console.log(`✅ Added/Verified: ${name}`);
        } catch (e) {
            console.log(`❌ Error ${name}: ${e.message}`);
        }
    }
    
    // Also verify types for existing status columns
    const statusCols = [
        'is_panel_clear', 'is_panel_labeled', 'is_panel_locked', 'are_lights_working',
        'are_outlets_unbroken', 'are_outlets_child_safe', 'are_outlets_splash_safe',
        'has_bare_wires', 'has_enough_outlets', 'is_extension_cord_temporary',
        'is_walkway_safe', 'are_appliance_cords_good', 'are_plugs_running_cool',
        'is_cctv_recording', 'is_dvr_room_secured', 'is_cctv_wire_protected'
    ];
    
    for (const col of statusCols) {
        try {
            await pool.query(`ALTER TABLE ph_schools_audit ALTER COLUMN ${col} TYPE INTEGER USING (
                CASE 
                    WHEN ${col}::text = 'true' THEN 1 
                    WHEN ${col}::text = 'false' THEN 0 
                    WHEN ${col}::text = '1' THEN 1
                    WHEN ${col}::text = '0' THEN 0
                    ELSE 0 
                END
            )`);
            await pool.query(`ALTER TABLE ph_schools_audit ALTER COLUMN ${col} SET DEFAULT 0`);
            console.log(`✅ Converted to INTEGER: ${col}`);
        } catch (e) {
            console.log(`⚠️ Skipped/Already Integer: ${col} (${e.message})`);
        }
    }

    console.log("🏁 Repair Complete.");
    pool.end();
}

fix();
