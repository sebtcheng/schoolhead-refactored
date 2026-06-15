const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging' });

const tables = ['ph_buildings_inventory', 'ph_buildings_repairs', 'ph_buildings_demolition'];

async function run() {
  for (const table of tables) {
    try {
      const col = await pool.query(`
        SELECT column_name, data_type, column_default 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'id'
      `, [table]);

      const current = col.rows[0];
      if (!current) { console.log(`⚠️  ${table}: no id column found`); continue; }

      if (current.column_default) {
        console.log(`✅ ${table}.id already has default: ${current.column_default}`);
      } else {
        console.log(`❌ ${table}.id has NO default — fixing...`);
        const seqName = `${table}_id_seq`;
        await pool.query(`CREATE SEQUENCE IF NOT EXISTS ${seqName};`);
        await pool.query(`SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false);`);
        await pool.query(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT nextval('${seqName}');`);
        console.log(`✅ ${table}.id fixed with sequence ${seqName}`);
      }
    } catch (e) {
      console.error(`❌ ${table}:`, e.message);
    }
  }
  await pool.end();
}
run();
