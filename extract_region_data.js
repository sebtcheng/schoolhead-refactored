import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

dotenv.config();

const EXPORTS_DIR = "exports";
const TABLES_TO_CHECK = [
    "ph_schools",
    "school_profiles",
    "school_location_profiles",
    "ph_buildings_inventory",
    "ph_buildings_repairs",
    "ph_buildings_demolition"
];

async function getActiveColumns(client, tableName) {
    console.log(`  🔍 Analyzing active columns for ${tableName}...`);
    const resCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [tableName]);
    const allCols = resCols.rows.map(r => r.column_name);
    
    const activeCols = [];
    for (const col of allCols) {
        const query = `SELECT EXISTS (SELECT 1 FROM "${tableName}" WHERE "${col}" IS NOT NULL AND TRIM(CAST("${col}" AS TEXT)) != '')`;
        const resExist = await client.query(query);
        if (resExist.rows[0].exists) {
            activeCols.push(col);
        }
    }
    console.log(`    - Found ${activeCols.length} active columns out of ${allCols.length}.`);
    return activeCols;
}

async function fetchSheetData(client, tableName, columns, schoolIds) {
    const q = `SELECT school_id, ${columns.map(c => `"${c}"`).join(', ')} FROM "${tableName}" WHERE school_id = ANY($1)`;
    const res = await client.query(q, [schoolIds]);
    return res.rows;
}

async function processRegion(client, region, schemaMap) {
    console.log(`\n📥 Processing Region: ${region}...`);
    
    // 1. Fetch Main Schools (Unit 1)
    const schoolQuery = `SELECT ${schemaMap['ph_schools'].map(c => `"${c}"`).join(', ')} FROM ph_schools WHERE TRIM(UPPER(region)) = $1`;
    const resSchools = await client.query(schoolQuery, [region]);
    const schoolsUnit1 = resSchools.rows;
    const schoolIds = schoolsUnit1.map(s => s.school_id).filter(id => id);
    const ierns = schoolsUnit1.map(s => s.iern).filter(id => id);

    if (schoolIds.length === 0) {
        console.log(`  ⚠️ No schools found.`);
        return;
    }

    // 2. Fetch Profiles (Units 2-6, 9)
    const profileQuery = `SELECT ${schemaMap['school_profiles'].map(c => `"${c}"`).join(', ')} FROM school_profiles WHERE iern = ANY($1)`;
    const resProfiles = await client.query(profileQuery, [ierns]);
    const schoolsUnitOther = resProfiles.rows;

    // 3. Fetch Location (Unit 8)
    const locationQuery = `SELECT ${schemaMap['school_location_profiles'].map(c => `"${c}"`).join(', ')} FROM school_location_profiles WHERE school_id = ANY($1)`;
    const resLocation = await client.query(locationQuery, [schoolIds]);
    const schoolsUnit8 = resLocation.rows;

    // 4. Fetch Unit 7 Child Tables
    const unit7Buildings = await fetchSheetData(client, 'ph_buildings_inventory', schemaMap['ph_buildings_inventory'], schoolIds);
    const unit7Repairs = await fetchSheetData(client, 'ph_buildings_repairs', schemaMap['ph_buildings_repairs'], schoolIds);
    const unit7Demolition = await fetchSheetData(client, 'ph_buildings_demolition', schemaMap['ph_buildings_demolition'], schoolIds);

    // Create Workbook
    const wb = XLSX.utils.book_new();

    // Add Sheets
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(schoolsUnit1), "Unit 1 - Identity");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(schoolsUnitOther), "Units 2-6 & 9 - Profiles");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unit7Buildings), "Unit 7 - Buildings");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unit7Repairs), "Unit 7 - Repairs");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unit7Demolition), "Unit 7 - Demolition");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(schoolsUnit8), "Unit 8 - Location");

    const filename = `${region.replace(/ /g, '_').replace(/\//g, '_')}_Unit_by_Unit_Audit.xlsx`;
    const filepath = path.join(EXPORTS_DIR, filename);
    
    XLSX.writeFile(wb, filepath);
    console.log(`  ✅ Successfully exported ${filename}`);
}

async function main() {
    if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR);
    
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        const client = await pool.connect();
        
        console.log("--- Global Column Discovery ---");
        const schemaMap = {};
        for (const table of TABLES_TO_CHECK) {
            schemaMap[table] = await getActiveColumns(client, table);
        }
        
        const resRegions = await client.query("SELECT DISTINCT TRIM(UPPER(region)) as reg FROM ph_schools WHERE region IS NOT NULL AND region != ''");
        const regions = resRegions.rows.map(r => r.reg);
        
        for (const region of regions) {
            await processRegion(client, region, schemaMap);
        }
        
        client.release();
        console.log("\n✨ Unit-by-Unit Excel Extraction Complete!");
        
    } catch (err) {
        console.error("❌ ERROR:", err.message);
    } finally {
        await pool.end();
    }
}

main();
