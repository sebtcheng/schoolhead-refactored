import pg from 'pg';
const { Client } = pg;

const stagingConnStr = 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging';

async function main() {
  const client = new Client({ connectionString: stagingConnStr, ssl: false });
  await client.connect();
  console.log('Connected to Staging database.');

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

  for (const table of tables) {
    console.log(`Processing table: ${table}`);
    try {
      // 1. Add column if it doesn't exist
      await client.query(`
        ALTER TABLE "${table}" 
        ADD COLUMN IF NOT EXISTS "school_yr" TEXT DEFAULT 'SY 25-26'
      `);
      console.log(`  - Added/verified column 'school_yr' in ${table}`);

      // 2. Update existing null records to 'SY 25-26'
      const updateRes = await client.query(`
        UPDATE "${table}" 
        SET "school_yr" = 'SY 25-26' 
        WHERE "school_yr" IS NULL
      `);
      console.log(`  - Updated ${updateRes.rowCount} NULL records to 'SY 25-26'`);

    } catch (err) {
      console.error(`  ❌ Error processing table ${table}:`, err.message);
    }
  }

  await client.end();
  console.log('Finished.');
}

main().catch(console.error);
