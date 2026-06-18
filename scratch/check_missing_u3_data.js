import pg from 'pg';
const { Client } = pg;

const clientStaging = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

const clientProd = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

async function main() {
  await clientStaging.connect();
  await clientProd.connect();

  console.log('Fetching production schools with non-null unit3_simplified_counts...');
  const prodRes = await clientProd.query(`
    SELECT school_id, iern, unit3_simplified_counts
    FROM ph_schools
    WHERE unit3_simplified_counts IS NOT NULL
  `);

  console.log(`Found ${prodRes.rows.length} schools in production.`);

  for (const row of prodRes.rows) {
    const { school_id, iern, unit3_simplified_counts } = row;
    
    // Check staging unit3_organized_classes
    const stagingRes = await clientStaging.query(`
      SELECT * FROM unit3_organized_classes
      WHERE school_id = $1 OR iern = $2
    `, [school_id, iern]);

    if (stagingRes.rows.length === 0) {
      // Let's check staging ph_schools to see if this school exists at all and what its status is
      const stagingPhRes = await clientStaging.query(`
        SELECT school_id, iern, unit3, unit3_completed FROM ph_schools
        WHERE school_id = $1 OR iern = $2
      `, [school_id, iern]);
      
      if (stagingPhRes.rows.length === 0) {
        console.log(`SchoolID=${school_id}, IERN=${iern}: Not even in staging ph_schools!`);
      } else {
        const ph = stagingPhRes.rows[0];
        console.log(`SchoolID=${school_id}, IERN=${iern}: In staging ph_schools but missing in unit3_organized_classes! unit3=${ph.unit3}, unit3_completed=${ph.unit3_completed}`);
      }
    } else {
      const sRow = stagingRes.rows[0];
      const hasNonNull = Object.keys(sRow).some(key => {
        return key.endsWith('_size') && sRow[key] !== null;
      });
      // console.log(`SchoolID=${school_id}, IERN=${sRow.iern || iern}: found in staging. Has non-null sizes? ${hasNonNull}`);
    }
  }

  await clientStaging.end();
  await clientProd.end();
}

main().catch(console.error);
