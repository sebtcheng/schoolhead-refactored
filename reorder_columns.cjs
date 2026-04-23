const pg = require('pg');
require('dotenv').config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function reorderColumns() {
    const client = await pool.connect();
    try {
        console.log("🚀 Starting Column Reordering Migration...");
        
        await client.query('BEGIN');

        // 1. Create temporary table with desired order
        console.log("📦 Creating temporary table with new schema...");
        await client.query(`
            CREATE TABLE third_level_officials_masterlist_new (
                tlid text NOT NULL,
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
                assignment_date date, -- Moved here
                status text,
                created_at timestamp with time zone,
                updated_at timestamp with time zone,
                CONSTRAINT third_level_officials_masterlist_pkey_new PRIMARY KEY (tlid)
            )
        `);

        // 2. Copy data from old to new
        console.log("🚚 Migrating data to the new structure...");
        await client.query(`
            INSERT INTO third_level_officials_masterlist_new (
                tlid, sort_index, strand, office, name, position, email, 
                alt_email_1, alt_email_2, contact_details, 
                alt_contact_details_1, alt_contact_details_2, 
                assignment_date, status, created_at, updated_at
            )
            SELECT 
                tlid, sort_index, strand, office, name, position, email, 
                alt_email_1, alt_email_2, contact_details, 
                alt_contact_details_1, alt_contact_details_2, 
                assignment_date, status, created_at, updated_at
            FROM third_level_officials_masterlist
        `);

        // 3. Drop old table
        console.log("🔥 Dropping old table...");
        await client.query('DROP TABLE third_level_officials_masterlist CASCADE');

        // 4. Rename new table
        console.log("♻️  Renaming new table to original name...");
        await client.query('ALTER TABLE third_level_officials_masterlist_new RENAME TO third_level_officials_masterlist');
        
        // 5. Restore constraints/indexes (Primary Key already added in CREATE TABLE)
        // Add status index and tlid index if needed
        await client.query('CREATE INDEX IF NOT EXISTS idx_tlom_status ON third_level_officials_masterlist(status)');

        await client.query('COMMIT');
        console.log("✅ Column reordering completed successfully!");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

reorderColumns();
