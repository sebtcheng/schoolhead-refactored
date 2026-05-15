const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting migration for ph_schools...');
    
    // Add missing columns if they don't exist
    await client.query(`
      ALTER TABLE ph_schools 
      ADD COLUMN IF NOT EXISTS ownership_document_path TEXT,
      ADD COLUMN IF NOT EXISTS ownership_doc_id INTEGER,
      ADD COLUMN IF NOT EXISTS ownership_doc_compressed_id INTEGER,
      ADD COLUMN IF NOT EXISTS ownership_doc_compressed_size BIGINT,
      ADD COLUMN IF NOT EXISTS local_file_path TEXT,
      ADD COLUMN IF NOT EXISTS local_file_name TEXT,
      ADD COLUMN IF NOT EXISTS local_file_size BIGINT,
      ADD COLUMN IF NOT EXISTS ownership_multiple JSONB,
      ADD COLUMN IF NOT EXISTS ownership_document_multiple JSONB;

      -- Ensure JSONB type if they already existed as text
      DO $$ 
      BEGIN 
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'ph_schools' AND column_name = 'ownership_multiple') = 'text' THEN
          ALTER TABLE ph_schools ALTER COLUMN ownership_multiple TYPE JSONB USING ownership_multiple::jsonb;
        END IF;
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'ph_schools' AND column_name = 'ownership_document_multiple') = 'text' THEN
          ALTER TABLE ph_schools ALTER COLUMN ownership_document_multiple TYPE JSONB USING ownership_document_multiple::jsonb;
        END IF;
      END $$;

      ALTER TABLE school_ownership_docs
      ADD COLUMN IF NOT EXISTS compressed_binary_id UUID,
      ADD COLUMN IF NOT EXISTS compressed_size BIGINT;
    `);
    
    console.log('Columns added successfully (or already existed).');

    // Also check if ownership_doc_id exists, just in case the error was real
    const checkCol = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ph_schools' AND column_name = 'ownership_doc_id'
    `);

    if (checkCol.rows.length === 0) {
      console.log('Adding missing ownership_doc_id column...');
      await client.query(`ALTER TABLE ph_schools ADD COLUMN ownership_doc_id INTEGER;`);
    } else {
      console.log('ownership_doc_id already exists.');
    }

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
