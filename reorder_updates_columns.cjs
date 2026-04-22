const pg = require('pg');
require('dotenv').config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function reorderUpdatesColumns() {
    const client = await pool.connect();
    try {
        console.log("🚀 Starting Column Reordering Migration for Updates Table...");
        
        await client.query('BEGIN');

        // 1. Create temporary table with desired order
        console.log("📦 Creating temporary updates table with new schema...");
        await client.query(`
            CREATE TABLE third_level_officials_updates_new (
                update_id SERIAL PRIMARY KEY,
                tlid text,
                sort_index integer,
                strand text,
                office text,
                name text,
                position text,
                email text,
                alt_email_1 text,
                alt_email_2 text,
                contact_details text,
                alt_contact_details_1 text,
                alt_contact_details_2 text,
                assignment_date date, -- Moved here (Position 14)
                status text,
                change_type text,
                updated_by text,
                created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Copy data from old to new
        console.log("🚚 Migrating update data to the new structure...");
        await client.query(`
            INSERT INTO third_level_officials_updates_new (
                tlid, sort_index, strand, office, name, position, email, 
                alt_email_1, alt_email_2, contact_details, 
                alt_contact_details_1, alt_contact_details_2, 
                assignment_date, status, change_type, updated_by, created_at
            )
            SELECT 
                tlid, sort_index, strand, office, name, position, email, 
                alt_email_1, alt_email_2, contact_details, 
                alt_contact_details_1, alt_contact_details_2, 
                assignment_date, status, change_type, updated_by, created_at
            FROM third_level_officials_updates
            ORDER BY update_id ASC
        `);

        // 3. Drop old table
        console.log("🔥 Dropping old updates table...");
        await client.query('DROP TABLE third_level_officials_updates CASCADE');

        // 4. Rename new table
        console.log("♻️  Renaming new table to original name...");
        await client.query('ALTER TABLE third_level_officials_updates_new RENAME TO third_level_officials_updates');
        
        // 5. Restore indexes/sequences
        console.log("🔍 Synchronizing ID sequence...");
        const seqRes = await client.query("SELECT pg_get_serial_sequence('third_level_officials_updates', 'update_id') as seq_name");
        const seqName = seqRes.rows[0].seq_name;
        
        if (seqName) {
            await client.query(`SELECT setval('${seqName}', (SELECT COALESCE(MAX(update_id), 0) + 1 FROM third_level_officials_updates), false)`);
        }
        
        await client.query('CREATE INDEX IF NOT EXISTS idx_tlou_tlid ON third_level_officials_updates(tlid)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_tlou_created ON third_level_officials_updates(created_at)');

        await client.query('COMMIT');
        console.log("✅ Updates table column reordering completed successfully!");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

reorderUpdatesColumns();
