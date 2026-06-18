import fs from 'fs';
import readline from 'readline';
import pg from 'pg';
const { Client } = pg;

const clientProd = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

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
  await clientProd.connect();
  console.log('Connected to production database: insightEd');

  // 1. Check online production counts
  const resOnline = await clientProd.query(`
    SELECT 
      COUNT(*) FILTER (WHERE unit7_furniture IS NOT NULL AND unit7_furniture::text <> '[]') as online_has_furniture,
      COUNT(*) FILTER (WHERE unit7_ict IS NOT NULL AND unit7_ict::text <> '[]') as online_has_ict,
      COUNT(*) FILTER (WHERE unit7_wash IS NOT NULL AND unit7_wash::text <> '[]') as online_has_wash,
      COUNT(*) FILTER (WHERE unit7_completed = TRUE OR unit6_updated_at IS NOT NULL) as online_completed
    FROM ph_schools
  `);
  console.log('Online Production Database Unit 6 Counts:');
  console.log(resOnline.rows[0]);
  await clientProd.end();

  // 2. Check backup SQL counts
  const filePath = 'e:/InsightEd-SchoolHead-Official/insightEd_tables_backup.sql';
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let hasFurniture = 0;
  let hasIct = 0;
  let completed = 0;

  for await (const line of rl) {
    lineCount++;
    if (line.includes('INSERT INTO "public"."ph_schools"')) {
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

      if (row.unit7_furniture && row.unit7_furniture !== '[]') {
        hasFurniture++;
      }
      if (row.unit7_ict && row.unit7_ict !== '[]') {
        hasIct++;
      }
      if (row.unit6_completed === 'true' || row.unit6 === '100') {
        completed++;
      }
    }
  }

  console.log('\nBackup SQL File Unit 6 Counts:');
  console.log({
    backup_has_furniture: hasFurniture,
    backup_has_ict: hasIct,
    backup_completed: completed
  });
}

main().catch(console.error);
