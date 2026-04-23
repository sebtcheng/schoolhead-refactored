const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', ssl: { rejectUnauthorized: false } });

async function fixAllFKs() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fks = [
      { table: 'engineer_image', name: 'engineer_image_project_id_fkey', definition: 'FOREIGN KEY (project_id) REFERENCES engineer_form(project_id) ON DELETE CASCADE' },
      { table: 'project_documents', name: 'project_documents_project_id_fkey', definition: 'FOREIGN KEY (project_id) REFERENCES engineer_form(project_id)' },
      { table: 'hrodi_project', name: 'hrodi_project_project_id_fkey', definition: 'FOREIGN KEY (project_id) REFERENCES engineer_form(project_id) ON DELETE CASCADE' },
      { table: 'co_finance', name: 'co_finance_project_id_fkey', definition: 'FOREIGN KEY (project_id) REFERENCES engineer_form(project_id) ON DELETE CASCADE' },
      { table: 'engineer_documents', name: 'engineer_documents_project_id_fkey', definition: 'FOREIGN KEY (project_id) REFERENCES engineer_form(project_id) ON DELETE CASCADE' }
    ];

    for (const fk of fks) {
      console.log(`Fixing FK ${fk.name} on ${fk.table}...`);
      await client.query(`ALTER TABLE ${fk.table} DROP CONSTRAINT IF EXISTS ${fk.name}`);
      await client.query(`ALTER TABLE ${fk.table} ADD CONSTRAINT ${fk.name} ${fk.definition}`);
      console.log(`✅ Fixed ${fk.name}.`);
    }

    await client.query('COMMIT');
    console.log("🚀 ALL Foreign Keys redirected to public.engineer_form successfully!");

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("💥 FK Fix Failed:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixAllFKs();
