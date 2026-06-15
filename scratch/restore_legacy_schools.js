import fs from 'fs';
import readline from 'readline';
import { pool } from '../api/utils/db.js';

async function restore() {
  try {
    console.log("=== STEP 1: CORRECTING LEGACY IERNS ===");
    
    // Correct Fernando C. Amorsolo SHS
    const res1 = await pool.query(
      "UPDATE ph_schools SET iern = '2026-07048' WHERE school_id = '360868' AND iern = 'LEGACY-360868' RETURNING school_name, iern;"
    );
    if (res1.rows.length > 0) {
      console.log(`Updated Fernando C. Amorsolo SHS: ${JSON.stringify(res1.rows[0])}`);
    } else {
      console.log("Fernando C. Amorsolo SHS already updated or not found.");
    }

    // Correct Mauricio Reynoso Sr. MES
    const res2 = await pool.query(
      "UPDATE ph_schools SET iern = '2026-06638' WHERE school_id = '111469' AND iern = 'LEGACY-111469' RETURNING school_name, iern;"
    );
    if (res2.rows.length > 0) {
      console.log(`Updated Mauricio Reynoso Sr. MES: ${JSON.stringify(res2.rows[0])}`);
    } else {
      console.log("Mauricio Reynoso Sr. MES already updated or not found.");
    }

    console.log("\n=== STEP 2: RESTORING MISSING SCHOOLS ===");
    
    console.log("Fetching active schools from database...");
    const dbRes = await pool.query('SELECT iern, school_id FROM ph_schools;');
    const activeIerns = new Set(dbRes.rows.map(r => r.iern));
    const activeSchoolIds = new Set(dbRes.rows.map(r => r.school_id));

    console.log("Reading backup file...");
    const fileStream = fs.createReadStream('ph_schools_04282026.sqlite');
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let insertQuery = '';
    let cols = null;
    let skipCount = 0;
    let insertCount = 0;

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('INSERT INTO')) {
        const colMatch = trimmed.match(/\(([^)]+)\)/);
        if (colMatch) {
          cols = colMatch[1].split(',').map(c => c.trim());
          insertQuery = `INSERT INTO public.ph_schools (${colMatch[1]}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`;
        }
      } else if (trimmed.startsWith('(')) {
        if (!cols) {
          console.error("Values line found before INSERT INTO columns list.");
          continue;
        }

        const values = parseSqlValues(trimmed);
        if (!values) continue;

        const iern = values[0];
        const schoolId = values[1];
        const schoolName = values[4];

        // Filter out 999... schools
        if ((iern && iern.startsWith('999')) || (schoolId && schoolId.startsWith('999'))) {
          skipCount++;
          continue;
        }

        // Check if missing
        if (!activeIerns.has(iern) && !activeSchoolIds.has(schoolId)) {
          console.log(`Inserting missing school: ${schoolId} - ${schoolName} (${iern})`);
          try {
            await pool.query(insertQuery, values);
            insertCount++;
          } catch (insertErr) {
            console.error(`Failed to insert school ${schoolId}:`, insertErr.message);
          }
        }
      }
    }

    console.log(`\nRestoration summary:`);
    console.log(`- Skip count (999... schools): ${skipCount}`);
    console.log(`- Insert count: ${insertCount}`);

  } catch (err) {
    console.error("Error in restoration:", err);
  } finally {
    await pool.end();
  }
}

restore();

// SQL parser helper inside to make this script self-contained
function parseSqlValues(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('(')) return null;
  
  const content = trimmed.substring(1, trimmed.length - 2); // strip leading ( and trailing ), or ),
  
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === "'") {
      if (inQuotes && content[i + 1] === "'") {
        current += "'";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current === 'NULL' ? null : current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current === 'NULL' ? null : current);
  return values;
}
