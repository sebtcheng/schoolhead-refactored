import pg from 'pg';
const { Client } = pg;

const stagingConnStr = 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging';

const tables = [
  'unit1_school_identity',
  'unit2_school_learners',
  'unit3_organized_classes',
  'unit4_learner_profile',
  'unit5_shifting_modality',
  'unit6_school_resources',
  'unit6_furniture_grades',
  'unit6_ecart_batches',
  'unit7_facilities',
  'unit7_buildings_inventory',
  'unit7_buildings_repairs',
  'unit7_buildings_demolition',
  'unit7_school_buildable_spaces',
  'unit8_location',
  'unit9_safety'
];

async function main() {
  const client = new Client({ connectionString: stagingConnStr, ssl: false });
  await client.connect();
  console.log('Connected to database to inspect constraints.');

  for (const table of tables) {
    const res = await client.query(`
      SELECT 
        conname AS constraint_name, 
        pg_get_constraintdef(c.oid) AS constraint_definition
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = $1 AND n.nspname = 'public';
    `, [table]);
    
    console.log(`Table: ${table}`);
    if (res.rows.length === 0) {
      console.log('  No constraints found.');
    } else {
      for (const row of res.rows) {
        console.log(`  - Constraint: ${row.constraint_name} | Definition: ${row.constraint_definition}`);
      }
    }
  }

  await client.end();
}

main().catch(console.error);
