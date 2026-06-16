import pg from 'pg';
import { pool as stagingPool } from '../api/utils/db.js';
const { Pool } = pg;

const prodConnectionString = 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd';

async function main() {
  const isProd = process.argv[2] === 'prod';
  
  let pool;
  if (isProd) {
    console.log("⚠️ RUNNING IN PRODUCTION MODE (insightEd database)");
    pool = new Pool({
      connectionString: prodConnectionString,
      ssl: { rejectUnauthorized: false }
    });
  } else {
    console.log("ℹ️ Running in Staging/Dev mode");
    pool = stagingPool;
  }

  const client = await pool.connect();
  try {
    // Check columns in schools_IERN to identify region and division column names
    const colRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'schools_IERN'
    `);
    const cols = colRes.rows.map(r => r.column_name);
    console.log("Columns in schools_IERN:", cols);

    // Find columns matching region/division (case insensitive)
    const regionCol = cols.find(c => c.toLowerCase() === 'region');
    const divisionCol = cols.find(c => c.toLowerCase() === 'division');
    const schoolIdCol = cols.find(c => c.toLowerCase() === 'schoolid');
    const schoolNameCol = cols.find(c => c.toLowerCase() === 'school_name' || c.toLowerCase() === 'schoolname');

    if (!regionCol || !divisionCol || !schoolIdCol) {
      throw new Error(`Could not find required columns. Found: region=${regionCol}, division=${divisionCol}, schoolid=${schoolIdCol}`);
    }

    console.log(`Using columns: ID="${schoolIdCol}", Name="${schoolNameCol}", Region="${regionCol}", Division="${divisionCol}"`);

    // Query missing schools grouped by Region and Division
    const groupRes = await client.query(`
      SELECT s."${regionCol}" as region, s."${divisionCol}" as division, COUNT(*) as count
      FROM "schools_IERN" s
      LEFT JOIN ph_schools p ON s."${schoolIdCol}" = p.school_id
      WHERE p.school_id IS NULL
      GROUP BY s."${regionCol}", s."${divisionCol}"
      ORDER BY count DESC, region, division
    `);

    console.log("\n=== SUMMARY: UNREGISTERED SCHOOLS BY REGION AND DIVISION ===");
    console.table(groupRes.rows);

    // Let's also print the individual schools for visibility
    const listRes = await client.query(`
      SELECT s."${schoolIdCol}" as school_id, s."${schoolNameCol || schoolIdCol}" as school_name, s."${regionCol}" as region, s."${divisionCol}" as division
      FROM "schools_IERN" s
      LEFT JOIN ph_schools p ON s."${schoolIdCol}" = p.school_id
      WHERE p.school_id IS NULL
      ORDER BY region, division, school_name
    `);

    console.log("\n=== DETAILED LIST OF UNREGISTERED SCHOOLS ===");
    console.table(listRes.rows);

    // Export to CSV files
    const fs = await import('fs/promises');
    
    // 1. Export summary CSV
    const summaryCsvHeader = "Region,Division,Count\n";
    const summaryCsvBody = groupRes.rows.map(row => 
      `"${row.region.replace(/"/g, '""')}","${row.division.replace(/"/g, '""')}",${row.count}`
    ).join("\n");
    await fs.writeFile('scratch/unregistered_schools_summary.csv', summaryCsvHeader + summaryCsvBody);
    console.log("📂 Exported summary to scratch/unregistered_schools_summary.csv");

    // 2. Export detailed CSV
    const detailedCsvHeader = "School ID,School Name,Region,Division\n";
    const detailedCsvBody = listRes.rows.map(row => 
      `"${row.school_id.replace(/"/g, '""')}","${row.school_name.replace(/"/g, '""')}","${row.region.replace(/"/g, '""')}","${row.division.replace(/"/g, '""')}"`
    ).join("\n");
    await fs.writeFile('scratch/unregistered_schools_detailed.csv', detailedCsvHeader + detailedCsvBody);
    console.log("📂 Exported detailed list to scratch/unregistered_schools_detailed.csv");

  } catch (err) {
    console.error("Error running report:", err);
  } finally {
    client.release();
    if (isProd) {
      await pool.end();
    } else {
      await stagingPool.end();
    }
  }
}
main();
