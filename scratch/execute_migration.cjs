'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Group A: Tables where IPC is a Primary Key or Unique
const uniqueTables = [
  'engineer_projects_inventory',
  'engineer_imported_beff',
  'eng_archi_created_projects'
];

// Group B: Tables where IPC is just a grouping column
const nonUniqueTables = [
  'engineer_form',
  'engineer_image',
  'engineer_documents',
  'variation_orders',
  'engineer_create',
  'engineer_create_updates'
];

async function run() {
  const mappingPath = path.join(__dirname, 'ipc_mapping.json');
  if (!fs.existsSync(mappingPath)) {
    console.error('Mapping file not found:', mappingPath);
    process.exit(1);
  }

  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  console.log(`Loaded ${mapping.length} unique mapping pairs.`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create temp table for mapping
    await client.query('CREATE TEMP TABLE temp_ipc_mapping (old_ipc TEXT PRIMARY KEY, new_ipc TEXT)');
    
    // 2. Insert mapping data (batch insert)
    console.log('Inserting mapping into temp table...');
    for (let i = 0; i < mapping.length; i += 500) {
      const chunk = mapping.slice(i, i + 500);
      const values = chunk.map((m, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(',');
      const params = chunk.flatMap(m => [m.old_ipc, m.new_ipc]);
      await client.query(`INSERT INTO temp_ipc_mapping (old_ipc, new_ipc) VALUES ${values}`, params);
    }

    let log = '';

    // 3. Handle Group A (Unique) tables
    for (const table of uniqueTables) {
      console.log(`Processing Group A table: ${table}...`);
      
      // Delete old_ipc records if new_ipc already exists to avoid PK violation
      const delRes = await client.query(`
        DELETE FROM ${table} t
        USING temp_ipc_mapping m
        WHERE t.ipc = m.old_ipc
        AND EXISTS (SELECT 1 FROM ${table} t2 WHERE t2.ipc = m.new_ipc)
      `);
      console.log(`Deleted ${delRes.rowCount} redundant rows from ${table}.`);
      log += `${table}_deleted: ${delRes.rowCount}\n`;

      // Update remaining old_ipc records
      const upRes = await client.query(`
        UPDATE ${table} t
        SET ipc = m.new_ipc
        FROM temp_ipc_mapping m
        WHERE t.ipc = m.old_ipc
      `);
      console.log(`Updated ${upRes.rowCount} rows in ${table}.`);
      log += `${table}_updated: ${upRes.rowCount}\n`;
    }

    // 4. Handle Group B (Non-Unique) tables
    for (const table of nonUniqueTables) {
      console.log(`Updating Group B table: ${table}...`);
      const res = await client.query(`
        UPDATE ${table} t
        SET ipc = m.new_ipc
        FROM temp_ipc_mapping m
        WHERE t.ipc = m.old_ipc
      `);
      log += `${table}: ${res.rowCount} rows\n`;
      console.log(`Updated ${res.rowCount} rows in ${table}.`);
    }

    fs.writeFileSync(path.join(__dirname, 'migration_log.txt'), log);

    console.log('Committing transaction...');
    await client.query('COMMIT');
    console.log('Migration successfully completed.');

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Migration failed, transaction rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
