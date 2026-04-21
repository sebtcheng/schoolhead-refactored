import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
    try {
        console.log("Migrating ESF7_Database...");
        await pool.query(`
            ALTER TABLE ESF7_Database
            ADD COLUMN IF NOT EXISTS esf7_id TEXT,
            ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS harvested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        `);
        console.log("Added new columns!");
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
migrate();
