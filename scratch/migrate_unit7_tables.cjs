const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: 'e:/InsightEd-SchoolHead-Official/.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('🏗️ Running Unit 7 schema migrations...');

    // 1. Repairs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS unit7_buildings_repairs (
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
    console.log('✅ unit7_buildings_repairs');

    // 2. Demolition Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS unit7_buildings_demolition (
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
    console.log('✅ unit7_buildings_demolition');

    // 3. Buildings Inventory Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS unit7_buildings_inventory (
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
        status TEXT,
        is_in_use BOOLEAN DEFAULT TRUE,
        seats TEXT,
        dimension TEXT,
        room_length NUMERIC,
        room_width NUMERIC,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ unit7_buildings_inventory');

    // 4. Buildable Spaces Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS unit7_school_buildable_spaces (
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
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unit7_buildable_spaces_iern_name 
      ON unit7_school_buildable_spaces(iern, space_name);
    `);
    console.log('✅ unit7_school_buildable_spaces');

    // 5. Facilities Completion & Metrics Summary
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
    console.log('✅ unit7_facilities');

    console.log('\n🎉 All Unit 7 tables created successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
