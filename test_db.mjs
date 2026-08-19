import { safeUsersQuery } from './packages/shared-db/src/db.js';

async function testFullChain() {
  console.log('--- 1. Regions ---');
  const regRes = await safeUsersQuery("SELECT DISTINCT region FROM all_locations_official WHERE region IS NOT NULL AND TRIM(region) != '' ORDER BY region");
  const regions = regRes.rows.map(r => r.region);
  console.log('Total regions:', regions.length);
  console.log('Includes BLANK REGION?', regions.includes('BLANK REGION'));
  console.log('Includes CENTRAL OFFICE?', regions.includes('CENTRAL OFFICE'));

  console.log('\n--- 2. Divisions for BLANK REGION ---');
  const divRes = await safeUsersQuery("SELECT DISTINCT division FROM all_locations_official WHERE division IS NOT NULL AND TRIM(division) != '' AND region = $1 ORDER BY division", ['BLANK REGION']);
  console.log('BLANK REGION Divisions:', divRes.rows.map(r => r.division));

  console.log('\n--- 3. Municipalities for BLANK REGION + BLANK DIVISION ---');
  const munRes = await safeUsersQuery("SELECT DISTINCT municipality FROM all_locations_official WHERE municipality IS NOT NULL AND TRIM(municipality) != '' AND region = $1 AND division = $2 ORDER BY municipality", ['BLANK REGION', 'BLANK DIVISION']);
  console.log('BLANK MUNICIPALITIES:', munRes.rows.map(r => r.municipality));

  console.log('\n--- 4. Schools for CENTRAL OFFICE + BHROD-SED ---');
  const schRes = await safeUsersQuery("SELECT school_id, school_name, region, division, municipality FROM schools_iern WHERE region = 'CENTRAL OFFICE' LIMIT 5");
  console.log('Central Office test schools count:', schRes.rows.length, schRes.rows);

  process.exit(0);
}

testFullChain().catch(e => { console.error(e); process.exit(1); });
