import pg from 'pg';
const { Client } = pg;

const stagingConnStr = 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging';

async function main() {
  const client = new Client({ connectionString: stagingConnStr, ssl: false });
  await client.connect();
  console.log('Connected to Staging database.');

  // Set local flag to bypass trigger block if any deletions or writes happen
  await client.query("SET LOCAL internal.authorized_app_deletion = 'true';");

  const alterations = [
    // Unit 1
    {
      table: 'unit1_school_identity',
      dropConstraint: 'unit1_school_identity_pkey1',
      dropUnique: 'unit1_school_identity_school_id_key1',
      addPK: 'PRIMARY KEY (iern, school_yr)',
      addUnique: 'UNIQUE (school_id, school_yr)'
    },
    // Unit 2
    {
      table: 'unit2_school_learners',
      dropConstraint: 'unit2_school_learners_pkey',
      dropUnique: 'unit2_school_learners_school_id_key',
      addPK: 'PRIMARY KEY (iern, school_yr)',
      addUnique: 'UNIQUE (school_id, school_yr)'
    },
    // Unit 3
    {
      table: 'unit3_organized_classes',
      dropConstraint: 'unit3_organized_classes_pkey',
      dropUnique: 'unit3_organized_classes_school_id_key',
      addPK: 'PRIMARY KEY (iern, school_yr)',
      addUnique: 'UNIQUE (school_id, school_yr)'
    },
    // Unit 4
    {
      table: 'unit4_learner_profile',
      dropConstraint: 'unit4_learner_profile_pkey',
      dropUnique: 'unit4_learner_profile_school_id_key',
      addPK: 'PRIMARY KEY (iern, school_yr)',
      addUnique: 'UNIQUE (school_id, school_yr)'
    },
    // Unit 5
    {
      table: 'unit5_shifting_modality',
      dropConstraint: 'unit5_shifting_modality_pkey',
      dropUnique: 'unit5_shifting_modality_school_id_key',
      addPK: 'PRIMARY KEY (iern, school_yr)',
      addUnique: 'UNIQUE (school_id, school_yr)'
    },
    // Unit 6
    {
      table: 'unit6_school_resources',
      dropConstraint: 'unit6_school_resources_pkey',
      dropUnique: 'unit6_school_resources_school_id_key',
      addPK: 'PRIMARY KEY (iern, school_yr)',
      addUnique: 'UNIQUE (school_id, school_yr)'
    },
    // Unit 7
    {
      table: 'unit7_facilities',
      dropConstraint: 'unit7_facilities_pkey',
      dropUnique: 'unit7_facilities_school_id_key',
      addPK: 'PRIMARY KEY (iern, school_yr)',
      addUnique: 'UNIQUE (school_id, school_yr)'
    },
    // Unit 8
    {
      table: 'unit8_location',
      dropConstraint: 'unit8_location_pkey',
      addPK: 'PRIMARY KEY (school_id, school_yr)'
    },
    // Unit 9
    {
      table: 'unit9_safety',
      dropConstraint: 'unit9_safety_pkey',
      addPK: 'PRIMARY KEY (school_id, school_yr)'
    }
  ];

  for (const alt of alterations) {
    console.log(`Processing alterations for table: ${alt.table}`);
    try {
      // Begin transaction for each table to be safe
      await client.query('BEGIN');

      if (alt.dropConstraint) {
        await client.query(`ALTER TABLE "${alt.table}" DROP CONSTRAINT IF EXISTS "${alt.dropConstraint}" CASCADE`);
        console.log(`  - Dropped constraint: ${alt.dropConstraint}`);
      }

      if (alt.dropUnique) {
        await client.query(`ALTER TABLE "${alt.table}" DROP CONSTRAINT IF EXISTS "${alt.dropUnique}" CASCADE`);
        console.log(`  - Dropped unique key: ${alt.dropUnique}`);
      }

      if (alt.addPK) {
        await client.query(`ALTER TABLE "${alt.table}" ADD ${alt.addPK}`);
        console.log(`  - Added PK: ${alt.addPK}`);
      }

      if (alt.addUnique) {
        await client.query(`ALTER TABLE "${alt.table}" ADD ${alt.addUnique}`);
        console.log(`  - Added Unique: ${alt.addUnique}`);
      }

      await client.query('COMMIT');
      console.log(`✅ Table ${alt.table} constraint migration successful.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ Table ${alt.table} failed:`, err.message);
    }
  }

  await client.end();
  console.log('Finished.');
}

main().catch(console.error);
