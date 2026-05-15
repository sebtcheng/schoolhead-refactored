import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dbUrl = process.env.DATABASE_URL;
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('20.24.58.49');

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

const sql = `
BEGIN;
SET LOCAL internal.authorized_app_deletion = 'true';

-- 1. Ensure the table exists with a baseline schema
CREATE TABLE IF NOT EXISTS school_ownership_docs (
  id          SERIAL PRIMARY KEY,
  iern        TEXT,
  school_id   TEXT,
  file_path   TEXT,
  file_name   TEXT,
  doc_type    TEXT,
  status      TEXT,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add the columns the upload route actually writes to
ALTER TABLE school_ownership_docs
  ADD COLUMN IF NOT EXISTS binary_id      UUID,
  ADD COLUMN IF NOT EXISTS file_size      BIGINT,
  ADD COLUMN IF NOT EXISTS original_size  BIGINT,
  ADD COLUMN IF NOT EXISTS hydra_manifest JSONB,
  ADD COLUMN IF NOT EXISTS ownership_document_type TEXT,
  ADD COLUMN IF NOT EXISTS compressed_binary_id UUID,
  ADD COLUMN IF NOT EXISTS compressed_size BIGINT;

-- 3. Dedupe by iern before applying the UNIQUE constraint
DELETE FROM school_ownership_docs
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY iern ORDER BY created_at DESC NULLS LAST, id DESC) AS rn
    FROM school_ownership_docs
    WHERE iern IS NOT NULL
  ) s WHERE s.rn = 1
);

-- 4. Apply the UNIQUE constraint that ON CONFLICT (iern) requires
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_ownership_docs_iern_unique'
  ) THEN
    ALTER TABLE school_ownership_docs
      ADD CONSTRAINT school_ownership_docs_iern_unique UNIQUE (iern);
  END IF;
END $$;

-- 5. Performance index for delete-by-id lookups
CREATE INDEX IF NOT EXISTS idx_sod_iern      ON school_ownership_docs (iern);
CREATE INDEX IF NOT EXISTS idx_sod_school_id ON school_ownership_docs (school_id);

COMMIT;
`;

async function run() {
  try {
    console.log("🚀 Running corrective migration for school_ownership_docs...");
    await pool.query(sql);
    console.log("✅ Migration successful!");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    if (err.detail) console.error("Detail:", err.detail);
    await pool.query('ROLLBACK').catch(() => {});
  } finally {
    await pool.end();
  }
}

run();
