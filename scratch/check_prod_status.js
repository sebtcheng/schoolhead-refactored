import pg from 'pg';
const { Client } = pg;

const clientProd = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

async function main() {
  await clientProd.connect();

  const schoolIds = [
    '313514', '303623', '122798', '122706', '122571', 
    '122871', '122795', '122796', '123173', '123141', 
    '122846', '313602', '123000', '123245', '303566', 
    '192518', '122794', '123171', '122912'
  ];

  console.log('Checking production ph_schools for the 19 schools...');

  const res2 = await clientProd.query(`
    SELECT school_id, iern, unit3, unit3_completed, unit3_simplified_counts::text
    FROM ph_schools
    WHERE school_id IN (${schoolIds.map(id => `'${id}'`).join(',')})
  `);

  res2.rows.forEach(r => {
    console.log(`SchoolID=${r.school_id}, IERN=${r.iern}: unit3=${r.unit3}, unit3_completed=${r.unit3_completed}, has_counts=${r.unit3_simplified_counts !== null}`);
  });

  await clientProd.end();
}

main().catch(console.error);
