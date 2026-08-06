import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

// 1. Source Database Pool (insightEd)
const sourceDbUrl = process.env.SOURCE_DATABASE_URL || 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd';
const sourcePool = new Pool({
  connectionString: sourceDbUrl,
  ssl: sourceDbUrl.includes('20.24.58.49') || sourceDbUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

// 2. Target Database Pool (users_database)
const targetUsersDbUrl = process.env.USERS_DATABASE_URL || 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/users_database';
const targetPool = new Pool({
  connectionString: targetUsersDbUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function migrateSchoolHeadUsers() {
  console.log('🚀 [HIGH-SPEED MIGRATION] Starting School Head user import from "insightEd" to "user_SchoolHead"...');
  const startTime = Date.now();

  try {
    // 1. Ensure user_SchoolHead table exists
    await targetPool.query(`
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

    // 2. Fetch all School Head users from main insightEd database
    console.log('\n📥 Querying School Head users from source database "insightEd"...');
    const sourceRes = await sourcePool.query(`
      SELECT * FROM users 
      WHERE LOWER(role) IN ('school head', 'school_head')
    `);

    const totalRows = sourceRes.rows.length;
    console.log(`Found ${totalRows} School Head user records in source "insightEd".`);

    if (totalRows === 0) {
      console.warn('⚠️ No School Head user records found in source database.');
      return;
    }

    const BATCH_SIZE = 500;
    let processed = 0;

    const cols = [
      'uid', 'email', 'role', 'created_at', 'first_name', 'last_name', 
      'region', 'division', 'province', 'city', 'barangay', 'office', 'position', 
      'disabled', 'contact_number', 'alt_email', 'account_category', 
      'password_hash', 'password_salt', 'hash_version', 'passcode', 'iern', 
      'registrant_type', 'school_id', 'has_seen_nexus_tutorial', 
      'registration_status', 'is_testaccount', 'division_multiple', 
      'assigned_region', 'assigned_division', 'failed_attempts', 
      'locked_until', 'designation'
    ];

    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
      const chunk = sourceRes.rows.slice(i, i + BATCH_SIZE);
      const valueRows = [];
      const queryParams = [];

      chunk.forEach((row, rowIndex) => {
        const offset = rowIndex * cols.length;
        const placeholders = cols.map((_, colIndex) => `$${offset + colIndex + 1}`);
        valueRows.push(`(${placeholders.join(', ')})`);

        queryParams.push(
          row.uid, row.email, row.role || 'School Head', row.created_at || new Date(), row.first_name, row.last_name,
          row.region, row.division, row.province, row.city, row.barangay, row.office, row.position,
          row.disabled || false, row.contact_number, row.alt_email, row.account_category,
          row.password_hash, row.password_salt, row.hash_version, row.passcode, row.iern,
          row.registrant_type, row.school_id, row.has_seen_nexus_tutorial || false,
          row.registration_status, row.is_testaccount || false, row.division_multiple,
          row.assigned_region, row.assigned_division, row.failed_attempts || 0,
          row.locked_until, row.designation
        );
      });

      const batchSql = `
        INSERT INTO user_SchoolHead (${cols.join(', ')})
        VALUES ${valueRows.join(',\n')}
        ON CONFLICT (uid) DO UPDATE SET
          email = EXCLUDED.email,
          role = EXCLUDED.role,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          region = EXCLUDED.region,
          division = EXCLUDED.division,
          province = EXCLUDED.province,
          city = EXCLUDED.city,
          office = EXCLUDED.office,
          position = EXCLUDED.position,
          disabled = EXCLUDED.disabled,
          contact_number = EXCLUDED.contact_number,
          account_category = EXCLUDED.account_category,
          password_hash = EXCLUDED.password_hash,
          password_salt = EXCLUDED.password_salt,
          hash_version = EXCLUDED.hash_version,
          passcode = EXCLUDED.passcode,
          school_id = EXCLUDED.school_id,
          iern = EXCLUDED.iern,
          registration_status = EXCLUDED.registration_status,
          designation = EXCLUDED.designation
      `;

      await targetPool.query(batchSql, queryParams);
      processed += chunk.length;
      console.log(`⚡ [Progress] Migrated ${processed} / ${totalRows} rows (${Math.round((processed / totalRows) * 100)}%)`);
    }

    const countRes = await targetPool.query('SELECT COUNT(*) FROM user_SchoolHead');
    const sampleRes = await targetPool.query('SELECT uid, email, role, school_id, user_sh_index FROM user_SchoolHead LIMIT 3');

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 [SUCCESS] School Head high-speed migration completed in ${elapsed}s!`);
    console.log(`📊 Summary:`);
    console.log(`   - Processed: ${processed} rows`);
    console.log(`   - Total in user_SchoolHead: ${countRes.rows[0].count} rows`);
    console.log(`\n📋 Sample Imported Records:`, sampleRes.rows);

  } catch (err) {
    console.error('💥 [ERROR] School Head migration failed:', err);
    process.exitCode = 1;
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

migrateSchoolHeadUsers();
