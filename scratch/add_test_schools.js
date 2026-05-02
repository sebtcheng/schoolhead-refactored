import pg from 'pg';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://Administrator1:<redacted>@20.24.58.49:6432/insightEd',
});

async function addTestSchools() {
  const client = await pool.connect();
  try {
    const passHash = await bcrypt.hash('testpassword123', 10);
    
    // Check columns in schools_IERN
    const colsRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'schools_IERN'");
    const cols = colsRes.rows.map(r => r.column_name);
    console.log("Columns in schools_IERN:", cols);

    const hasIERN = cols.includes('IERN');
    const hasiernLower = cols.includes('iern');
    
    let count = 0;
    for (let i = 999000; i <= 999800; i++) {
        const schoolId = i.toString();
        const iern = schoolId;
        
        try {
            // 1. Insert into schools_IERN
            if (hasIERN) {
                const checkIERN = await client.query('SELECT 1 FROM "schools_IERN" WHERE "SchoolID" = $1', [schoolId]);
                if (checkIERN.rowCount === 0) {
                    await client.query('INSERT INTO "schools_IERN" ("SchoolID", "IERN", "Region", "Division") VALUES ($1, $2, $3, $4)', [schoolId, iern, 'BLANK REGION', 'BLANK DIVISION']);
                }
            } else if (hasiernLower) {
                const checkIERN = await client.query('SELECT 1 FROM "schools_IERN" WHERE "SchoolID" = $1', [schoolId]);
                if (checkIERN.rowCount === 0) {
                    await client.query('INSERT INTO "schools_IERN" ("SchoolID", "iern", "Region", "Division") VALUES ($1, $2, $3, $4)', [schoolId, iern, 'BLANK REGION', 'BLANK DIVISION']);
                }
            }

            // 2. Insert into ph_schools
            const checkPh = await client.query('SELECT 1 FROM ph_schools WHERE school_id = $1 OR iern = $2', [schoolId, iern]);
            if (checkPh.rowCount === 0) {
                await client.query('INSERT INTO ph_schools (school_id, iern, school_name, region, division) VALUES ($1, $2, $3, $4, $5)', [schoolId, iern, `Test School ${i}`, 'BLANK REGION', 'BLANK DIVISION']);
            }

            // 3. Insert into users
            const checkUser = await client.query('SELECT 1 FROM users WHERE school_id = $1 OR iern = $2', [schoolId, iern]);
            if (checkUser.rowCount === 0) {
                const uid = uuidv4();
                await client.query(`
                    INSERT INTO users (
                        uid, email, password_hash, hash_version, role, first_name, last_name,
                        school_id, iern, region, division, province, city, barangay, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
                `, [
                    uid, `test${i}@insighted.test`, passHash, 'bcrypt', 'School Head',
                    'Test', `Head ${i}`, schoolId, iern, 'BLANK REGION', 'BLANK DIVISION',
                    'BLANK PROVINCE', 'BLANK CITY', 'BLANK BARANGAY'
                ]);
            }
            
            count++;
            if (count % 100 === 0) console.log(`Processed ${count} records...`);
        } catch (innerErr) {
             console.error(`Error processing school ${schoolId}:`, innerErr.message);
        }
    }
    console.log(`Finished adding test schools. Successfully processed: ${count}`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    client.release();
    pool.end();
  }
}

addTestSchools();
