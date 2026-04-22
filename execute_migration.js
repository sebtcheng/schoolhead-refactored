import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const conversions = [
            { old_id: '114042', new_id: '502995', new_name: 'Marinab Integrated School' },
            { old_id: '114374', new_id: '502994', new_name: 'Esperanza Integrated School' },
            { old_id: '114183', new_id: '502996', new_name: 'Vinisitahan Integrated School' }
        ];

        for (const conv of conversions) {
            console.log(`Processing conversion: ${conv.old_id} -> ${conv.new_id}`);

            // 1. Get original data
            const origRes = await client.query('SELECT * FROM "schools_IERN" WHERE "SchoolID" = $1', [conv.old_id]);
            if (origRes.rows.length === 0) {
                throw new Error(`Original school ${conv.old_id} not found`);
            }
            const orig = origRes.rows[0];

            // 2. Insert into pending_schools
            // registration_type, old_school_id, school_id, school_name, region, division, district, province, municipality, leg_district, barangay, street_address, mother_school_id, curricular_offering, latitude, longitude, submitted_by, status, submitted_at, reviewed_at, reviewed_by
            const insertPendingQuery = `
                INSERT INTO pending_schools (
                    registration_type, old_school_id, school_id, school_name, 
                    region, division, district, province, municipality, 
                    leg_district, barangay, street_address, mother_school_id, 
                    curricular_offering, latitude, longitude, 
                    submitted_by, status, submitted_at, reviewed_at, reviewed_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW(), $19)
            `;
            const pendingValues = [
                'conversion', conv.old_id, conv.new_id, conv.new_name,
                orig.Region, orig.Division, orig.District, orig.Province, orig.Municipality,
                orig.Legislative_District, orig.Barangay, orig.Street_Address, orig.Mother_School_ID,
                'Integrated School', orig.Latitude, orig.Longitude,
                'bd891ed6-2d8d-45a5-bc9b-03a4112bbfcd', 'approved', 'bd891ed6-2d8d-45a5-bc9b-03a4112bbfcd'
            ];
            await client.query(insertPendingQuery, pendingValues);
            console.log(`  - Inserted into pending_schools`);

            // 3. Update new record in schools_IERN
            const updateNewQuery = `
                UPDATE "schools_IERN" SET
                    "Barangay" = $1,
                    "Latitude" = $2,
                    "Longitude" = $3,
                    "Curricular_Offering" = $4,
                    "Street_Address" = $5,
                    "Mother_School_ID" = $6,
                    "Legislative_District" = $7,
                    "updated_at" = NOW()
                WHERE "SchoolID" = $8
            `;
            const updateValues = [
                orig.Barangay, orig.Latitude, orig.Longitude,
                'Integrated School', orig.Street_Address, orig.Mother_School_ID,
                orig.Legislative_District, conv.new_id
            ];
            await client.query(updateNewQuery, updateValues);
            console.log(`  - Updated new record in schools_IERN`);

            // 4. Archive original record in schools_IERN
            await client.query('UPDATE "schools_IERN" SET "status" = \'Archived\', "updated_at" = NOW() WHERE "SchoolID" = $1', [conv.old_id]);
            console.log(`  - Archived original record in schools_IERN`);
        }

        await client.query('COMMIT');
        console.log('SUCCESS: Migration completed.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('ERROR during migration:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
