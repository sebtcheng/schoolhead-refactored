const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("Creating outbox table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.engineer_form_outbox AS 
      SELECT * FROM public.engineer_form WHERE 1=0
    `);
    
    await client.query(`
      ALTER TABLE public.engineer_form_outbox 
      ADD COLUMN IF NOT EXISTS outbox_reason TEXT,
      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_ef_outbox_ipc ON public.engineer_form_outbox(ipc)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ef_outbox_project_id ON public.engineer_form_outbox(project_id)`);
    
    console.log("Success: Table engineer_form_outbox created.");
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
