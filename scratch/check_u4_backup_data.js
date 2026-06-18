import fs from 'fs';
import readline from 'readline';

// Robust PostgreSQL values parser
function parseSqlValues(valuesStr) {
  const values = [];
  let currentToken = '';
  let inQuotes = false;
  let i = 0;

  while (i < valuesStr.length) {
    const char = valuesStr[i];

    if (inQuotes) {
      if (char === "'") {
        if (valuesStr[i + 1] === "'") {
          currentToken += "'";
          i += 2;
          continue;
        } else {
          inQuotes = false;
        }
      } else {
        currentToken += char;
      }
    } else {
      if (char === "'") {
        inQuotes = true;
      } else if (char === ',') {
        values.push(cleanValue(currentToken));
        currentToken = '';
      } else {
        currentToken += char;
      }
    }
    i++;
  }
  values.push(cleanValue(currentToken));
  return values;
}

function cleanValue(val) {
  let cleaned = val.trim();
  if (cleaned.includes('::')) {
    cleaned = cleaned.split('::')[0].trim();
  }
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  if (cleaned.toUpperCase() === 'NULL') {
    return null;
  }
  return cleaned;
}

async function main() {
  const filePath = 'e:/InsightEd-SchoolHead-Official/insightEd_tables_backup.sql';
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let insertCount = 0;
  let hasGroups = 0;
  let hasBmi = 0;
  let hasAls = 0;
  let completed = 0;

  console.log('Scanning backup file for Unit 4 counts...');

  for await (const line of rl) {
    lineCount++;
    if (line.includes('INSERT INTO "public"."ph_schools"')) {
      insertCount++;
      const colStart = line.indexOf('(') + 1;
      const colEnd = line.indexOf(') VALUES');
      const colsStr = line.substring(colStart, colEnd);
      const columns = colsStr.split(',').map(c => c.trim().replace(/"/g, ''));

      const valStart = line.indexOf('VALUES (') + 8;
      const valEnd = line.lastIndexOf(')');
      const valuesStr = line.substring(valStart, valEnd);

      const parsedValues = parseSqlValues(valuesStr);

      if (columns.length !== parsedValues.length) {
        continue;
      }

      const row = {};
      columns.forEach((col, idx) => {
        row[col] = parsedValues[idx];
      });

      if (row.selected_learner_groups && row.selected_learner_groups !== '[]') {
        hasGroups++;
      }
      
      const wasted = parseInt(row.bmi_wasted) || 0;
      const sev_wasted = parseInt(row.bmi_severely_wasted) || 0;
      if (wasted > 0 || sev_wasted > 0) {
        hasBmi++;
      }

      const als = parseInt(row.als_total) || 0;
      if (als > 0) {
        hasAls++;
      }

      if (row.unit4_completed === 'true' || row.unit4 === '100') {
        completed++;
      }
    }
  }

  console.log(`\nScan finished.`);
  console.log(`Total INSERT lines: ${insertCount}`);
  console.log(`Has groups in backup: ${hasGroups}`);
  console.log(`Has BMI in backup: ${hasBmi}`);
  console.log(`Has ALS in backup: ${hasAls}`);
  console.log(`Completed Unit 4 in backup: ${completed}`);
}

main().catch(console.error);
