const pg = require('pg');
require('dotenv').config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function seedOfficials() {
    const client = await pool.connect();
    try {
        console.log("🌱 Seeding Test Officials...");
        await client.query('BEGIN');

        const testOfficials = [
            {
                tlid: 'TL-2026-X001',
                name: 'JUAN MANUEL G. SANTOS',
                strand: 'Planning Service',
                office: 'Planning Service',
                position: 'Director IV',
                email: 'juan.santos@deped.gov.ph',
                status: 'Active'
            },
            {
                tlid: 'TL-2026-X002',
                name: 'ELENA M. DELA CRUZ',
                strand: 'Curriculum and Teaching (CT)',
                office: 'Bureau of Curriculum Development',
                position: 'Assistant Secretary',
                email: 'elena.delacruz@deped.gov.ph',
                status: 'Active'
            }
        ];

        for (const official of testOfficials) {
            // Check if exists
            const check = await client.query('SELECT tlid FROM third_level_officials_masterlist WHERE tlid = $1', [official.tlid]);
            if (check.rows.length === 0) {
                console.log(`➕ Adding ${official.name}...`);
                await client.query(`
                    INSERT INTO third_level_officials_masterlist (
                        tlid, name, strand, office, position, email, status, assignment_date
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE)
                `, [official.tlid, official.name, official.strand, official.office, official.position, official.email, official.status]);

                // Record in updates ledger
                await client.query(`
                    INSERT INTO third_level_officials_updates (
                        tlid, name, strand, office, position, email, status, change_type, updated_by, assignment_date
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE)
                `, [official.tlid, official.name, official.strand, official.office, official.position, official.email, official.status, 'INITIAL REGISTRY', 'SYSTEM ADMIN']);
            } else {
                console.log(`⚠️ ${official.name} already exists. Skipping.`);
            }
        }

        await client.query('COMMIT');
        console.log("✅ Seeding completed successfully!");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Seeding failed:", err);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

seedOfficials();
