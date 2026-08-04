import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

const targetUsersDbUrl = process.env.USERS_DATABASE_URL || 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/users_database';
const usersPool = new Pool({
  connectionString: targetUsersDbUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function segregateUsers() {
  console.log('🚀 [USER-SEGREGATION] Starting user table segregation in users_database...');
  const startTime = Date.now();

  try {
    // 1. Create user_SchoolHead table
    console.log('\n🏫 [1/6] Creating user_SchoolHead table & index (SH-000001)...');
    await usersPool.query(`
      CREATE TABLE IF NOT EXISTS user_SchoolHead (
        uid TEXT PRIMARY KEY,
        seq_id BIGSERIAL,
        user_sh_index TEXT GENERATED ALWAYS AS ('SH-' || LPAD(seq_id::text, 6, '0')) STORED UNIQUE,
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
        disabled BOOLEAN DEFAULT FALSE,
        contact_number TEXT,
        alt_email TEXT,
        account_category TEXT,
        password_hash TEXT,
        password_salt TEXT,
        hash_version TEXT,
        passcode TEXT,
        iern TEXT,
        registrant_type TEXT,
        school_id TEXT,
        has_seen_nexus_tutorial BOOLEAN DEFAULT FALSE,
        registration_status VARCHAR(50),
        is_testaccount BOOLEAN DEFAULT FALSE,
        division_multiple TEXT[],
        assigned_region TEXT,
        assigned_division TEXT,
        failed_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMPTZ,
        designation VARCHAR(100)
      );

      CREATE INDEX IF NOT EXISTS idx_user_SchoolHead_email ON user_SchoolHead (LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_user_SchoolHead_school_id ON user_SchoolHead (school_id);
    `);
    console.log('✅ Table user_SchoolHead created.');

    // 2. Create user_ROSDO table
    console.log('\n🏛️ [2/6] Creating user_ROSDO table & index (ROSDO-000001)...');
    await usersPool.query(`
      CREATE TABLE IF NOT EXISTS user_ROSDO (
        uid TEXT PRIMARY KEY,
        seq_id BIGSERIAL,
        user_rosdo_index TEXT GENERATED ALWAYS AS ('ROSDO-' || LPAD(seq_id::text, 6, '0')) STORED UNIQUE,
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
        disabled BOOLEAN DEFAULT FALSE,
        contact_number TEXT,
        alt_email TEXT,
        account_category TEXT,
        password_hash TEXT,
        password_salt TEXT,
        hash_version TEXT,
        passcode TEXT,
        iern TEXT,
        registrant_type TEXT,
        school_id TEXT,
        has_seen_nexus_tutorial BOOLEAN DEFAULT FALSE,
        registration_status VARCHAR(50),
        is_testaccount BOOLEAN DEFAULT FALSE,
        division_multiple TEXT[],
        assigned_region TEXT,
        assigned_division TEXT,
        failed_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMPTZ,
        designation VARCHAR(100)
      );

      CREATE INDEX IF NOT EXISTS idx_user_ROSDO_email ON user_ROSDO (LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_user_ROSDO_region_division ON user_ROSDO (region, division);
    `);
    console.log('✅ Table user_ROSDO created.');

    // 3. Create user_INFRA table
    console.log('\n🏗️ [3/6] Creating user_INFRA table & index (INFRA-000001)...');
    await usersPool.query(`
      CREATE TABLE IF NOT EXISTS user_INFRA (
        uid TEXT PRIMARY KEY,
        seq_id BIGSERIAL,
        user_infra_index TEXT GENERATED ALWAYS AS ('INFRA-' || LPAD(seq_id::text, 6, '0')) STORED UNIQUE,
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
        disabled BOOLEAN DEFAULT FALSE,
        contact_number TEXT,
        alt_email TEXT,
        account_category TEXT,
        password_hash TEXT,
        password_salt TEXT,
        hash_version TEXT,
        passcode TEXT,
        iern TEXT,
        registrant_type TEXT,
        school_id TEXT,
        has_seen_nexus_tutorial BOOLEAN DEFAULT FALSE,
        registration_status VARCHAR(50),
        is_testaccount BOOLEAN DEFAULT FALSE,
        division_multiple TEXT[],
        assigned_region TEXT,
        assigned_division TEXT,
        failed_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMPTZ,
        designation VARCHAR(100)
      );

      CREATE INDEX IF NOT EXISTS idx_user_INFRA_email ON user_INFRA (LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_user_INFRA_region_division ON user_INFRA (region, division);
    `);
    console.log('✅ Table user_INFRA created.');

    // 4. Populate user_SchoolHead
    console.log('\n📦 [4/6] Populating user_SchoolHead table...');
    await usersPool.query('TRUNCATE TABLE user_SchoolHead');
    const shInsert = await usersPool.query(`
      INSERT INTO user_SchoolHead (
        uid, email, role, created_at, first_name, last_name, 
        region, division, province, city, barangay, office, position, 
        disabled, contact_number, alt_email, account_category, 
        password_hash, password_salt, hash_version, passcode, iern, 
        registrant_type, school_id, has_seen_nexus_tutorial, 
        registration_status, is_testaccount, division_multiple, 
        assigned_region, assigned_division, failed_attempts, 
        locked_until, designation
      )
      SELECT 
        uid, email, role, created_at, first_name, last_name, 
        region, division, province, city, barangay, office, position, 
        disabled, contact_number, alt_email, account_category, 
        password_hash, password_salt, hash_version, passcode, iern, 
        registrant_type, school_id, has_seen_nexus_tutorial, 
        registration_status, is_testaccount, division_multiple, 
        assigned_region, assigned_division, failed_attempts, 
        locked_until, designation
      FROM users
      WHERE LOWER(role) IN ('school head', 'school_head')
      ON CONFLICT (uid) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        region = EXCLUDED.region,
        division = EXCLUDED.division,
        password_hash = EXCLUDED.password_hash,
        passcode = EXCLUDED.passcode,
        school_id = EXCLUDED.school_id
    `);
    console.log(`✅ Populated user_SchoolHead (${shInsert.rowCount} rows).`);

    // 5. Populate user_ROSDO
    console.log('\n📦 [5/6] Populating user_ROSDO table...');
    await usersPool.query('TRUNCATE TABLE user_ROSDO');
    const rosdoInsert = await usersPool.query(`
      INSERT INTO user_ROSDO (
        uid, email, role, created_at, first_name, last_name, 
        region, division, province, city, barangay, office, position, 
        disabled, contact_number, alt_email, account_category, 
        password_hash, password_salt, hash_version, passcode, iern, 
        registrant_type, school_id, has_seen_nexus_tutorial, 
        registration_status, is_testaccount, division_multiple, 
        assigned_region, assigned_division, failed_attempts, 
        locked_until, designation
      )
      SELECT 
        uid, email, role, created_at, first_name, last_name, 
        region, division, province, city, barangay, office, position, 
        disabled, contact_number, alt_email, account_category, 
        password_hash, password_salt, hash_version, passcode, iern, 
        registrant_type, school_id, has_seen_nexus_tutorial, 
        registration_status, is_testaccount, division_multiple, 
        assigned_region, assigned_division, failed_attempts, 
        locked_until, designation
      FROM users
      WHERE LOWER(role) IN ('regional office', 'school division office', 'rosdo', 'sdo', 'ro')
      ON CONFLICT (uid) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        region = EXCLUDED.region,
        division = EXCLUDED.division,
        password_hash = EXCLUDED.password_hash,
        passcode = EXCLUDED.passcode
    `);
    console.log(`✅ Populated user_ROSDO (${rosdoInsert.rowCount} rows).`);

    // 6. Populate user_INFRA
    console.log('\n📦 [6/6] Populating user_INFRA table...');
    await usersPool.query('TRUNCATE TABLE user_INFRA');
    const infraInsert = await usersPool.query(`
      INSERT INTO user_INFRA (
        uid, email, role, created_at, first_name, last_name, 
        region, division, province, city, barangay, office, position, 
        disabled, contact_number, alt_email, account_category, 
        password_hash, password_salt, hash_version, passcode, iern, 
        registrant_type, school_id, has_seen_nexus_tutorial, 
        registration_status, is_testaccount, division_multiple, 
        assigned_region, assigned_division, failed_attempts, 
        locked_until, designation
      )
      SELECT 
        uid, email, role, created_at, first_name, last_name, 
        region, division, province, city, barangay, office, position, 
        disabled, contact_number, alt_email, account_category, 
        password_hash, password_salt, hash_version, passcode, iern, 
        registrant_type, school_id, has_seen_nexus_tutorial, 
        registration_status, is_testaccount, division_multiple, 
        assigned_region, assigned_division, failed_attempts, 
        locked_until, designation
      FROM users
      WHERE LOWER(role) IN ('efd engineer', 'regional engineer', 'division engineer', 'architect', 'efd', 'hrodi', 'deped engineer', 'deped_engineer')
      ON CONFLICT (uid) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        region = EXCLUDED.region,
        division = EXCLUDED.division,
        password_hash = EXCLUDED.password_hash,
        passcode = EXCLUDED.passcode
    `);
    console.log(`✅ Populated user_INFRA (${infraInsert.rowCount} rows).`);

    // Audit summary
    const shCount = await usersPool.query('SELECT COUNT(*) FROM user_SchoolHead');
    const rosdoCount = await usersPool.query('SELECT COUNT(*) FROM user_ROSDO');
    const infraCount = await usersPool.query('SELECT COUNT(*) FROM user_INFRA');

    const shSample = await usersPool.query('SELECT uid, email, role, user_sh_index FROM user_SchoolHead LIMIT 2');
    const rosdoSample = await usersPool.query('SELECT uid, email, role, user_rosdo_index FROM user_ROSDO LIMIT 2');
    const infraSample = await usersPool.query('SELECT uid, email, role, user_infra_index FROM user_INFRA LIMIT 2');

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 [SUCCESS] User segregation complete in ${elapsed}s!`);
    console.log(`📊 Final Counts & Sample Auto-Indexes:`);
    console.log(`   - user_SchoolHead: ${shCount.rows[0].count} rows | Sample Index: ${shSample.rows[0]?.user_sh_index}`);
    console.log(`   - user_ROSDO:      ${rosdoCount.rows[0].count} rows | Sample Index: ${rosdoSample.rows[0]?.user_rosdo_index}`);
    console.log(`   - user_INFRA:      ${infraCount.rows[0].count} rows | Sample Index: ${infraSample.rows[0]?.user_infra_index}`);

  } catch (err) {
    console.error('🔥 [ERROR] Segregation failed:', err);
    process.exitCode = 1;
  } finally {
    await usersPool.end();
  }
}

segregateUsers();
