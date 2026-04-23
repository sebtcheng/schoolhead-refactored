
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function debug() {
  try {
    console.log("--- Checking engineer_form NOT NULL constraints ---");
    const colRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'engineer_form' AND is_nullable = 'NO' AND column_default IS NULL
    `);
    console.log("Required columns (no default):", colRes.rows.map(r => r.column_name).join(', '));

    const docCols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'engineer_documents'
    `);
    console.log("engineer_documents columns:", docCols.rows.map(r => r.column_name).join(', '));

    console.log("\n--- Testing save-project logic (Dry Run / BEGIN and ROLLBACK) ---");
    // I'll simulate the INSERTs that happen in save-project
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Attempting a mock insert into engineer_form
      const mockIpc = 'INF-01-2026-TEST-' + Date.now();
      const projectInsert = await client.query(`
        INSERT INTO "engineer_form" (
          project_name, school_name, school_id, ipc, engineer_id, status_of_construction_phase
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING project_id
      `, ['Test Project', 'Test School', '123456', mockIpc, 'test-uid', 'Ongoing']);
      
      const newProjectId = projectInsert.rows[0].project_id;
      console.log("Mock Project ID created:", newProjectId);

      // Attempting mock insert into engineer_documents
      await client.query(`
        INSERT INTO engineer_documents (project_id, ipc, uploader_id)
        VALUES ($1, $2, $3)
      `, [newProjectId, mockIpc, 'test-uid']);
      console.log("Mock Document record created.");

      // Attempting mock insert into engineer_image
      // This is where I suspect the failure if file_path is missing but provided,
      // OR if the user's manual change to api/index.js had a typo.
      
      console.log("Rolling back...");
      await client.query('ROLLBACK');
      console.log("Dry run successful (no schema errors in these steps).");
    } catch (e) {
      console.error("--- Error during mock save ---");
      console.error(e.message);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

  } catch (err) {
    console.error("Connection Error:", err.message);
  } finally {
    await pool.end();
  }
}

debug();
