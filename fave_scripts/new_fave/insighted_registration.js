import pkg from 'pg';
const { Client } = pkg;
import 'dotenv/config';

async function main() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("ERROR: DATABASE_URL not found in .env");
        process.exit(1);
    }

    console.log("--- Regional School Migration Audit Initialized (Node.js) ---");

    const client = new Client({
        connectionString: dbUrl,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();

        const query = `
            WITH legacy_counts AS (
                SELECT TRIM(UPPER("Region")) as region_name, COUNT(*) as total_legacy
                FROM "schools_IERN"
                WHERE "Region" IS NOT NULL 
                  AND TRIM(UPPER("Region")) NOT IN ('', 'BLANK', 'BLANK REGION')
                GROUP BY TRIM(UPPER("Region"))
            ),
            migrated_counts AS (
                SELECT TRIM(UPPER(legacy."Region")) as region_name, COUNT(DISTINCT legacy.iern) as migrated_count
                FROM "schools_IERN" legacy
                JOIN ph_schools prod ON legacy.iern = prod.iern
                WHERE legacy."Region" IS NOT NULL 
                  AND TRIM(UPPER(legacy."Region")) NOT IN ('', 'BLANK', 'BLANK REGION')
                GROUP BY TRIM(UPPER(legacy."Region"))
            ),
            completed_counts AS (
                SELECT TRIM(UPPER(legacy."Region")) as region_name, COUNT(DISTINCT legacy.iern) as completed_count
                FROM "schools_IERN" legacy
                JOIN ph_school_completion comp ON legacy.iern = comp.iern
                WHERE legacy."Region" IS NOT NULL 
                  AND TRIM(UPPER(legacy."Region")) NOT IN ('', 'BLANK', 'BLANK REGION')
                  AND comp.total_completion = 100
                GROUP BY TRIM(UPPER(legacy."Region"))
            )
            SELECT 
                l.region_name,
                l.total_legacy,
                COALESCE(m.migrated_count, 0) as migrated_count,
                COALESCE(c.completed_count, 0) as completed_count,
                ROUND((COALESCE(m.migrated_count, 0)::numeric / l.total_legacy * 100), 2) as reg_percentage,
                ROUND((COALESCE(c.completed_count, 0)::numeric / l.total_legacy * 100), 2) as comp_percentage
            FROM legacy_counts l
            LEFT JOIN migrated_counts m ON l.region_name = m.region_name
            LEFT JOIN completed_counts c ON l.region_name = c.region_name
            ORDER BY reg_percentage DESC, l.region_name ASC;
        `;

        const res = await client.query(query);
        const rows = res.rows;

        // Output Table
        const headers = ["Region", "Total", "Registered", "100% Comp", "Reg %", "Comp %"];
        const colWidths = [26, 8, 12, 12, 10, 10];

        // Border
        const border = "+" + colWidths.map(w => "-".repeat(w)).join("+") + "+";
        console.log(border);

        // Header
        const headerRow = "|" + headers.map((h, i) => ` ${h}`.padEnd(colWidths[i] - 0)).join("|") + "|"; // Simplified padding
        // Adjust padding to match visual style
        const formattedHeader = "|" + headers.map((h, i) => {
            const str = " " + h;
            return str.padEnd(colWidths[i]);
        }).join("|") + "|";
        console.log(formattedHeader);
        console.log(border);

        let grandLegacy = 0;
        let grandMigrated = 0;
        let grandCompleted = 0;

        for (const row of rows) {
            const { region_name, total_legacy, migrated_count, completed_count, reg_percentage, comp_percentage } = row;
            
            const legacy = parseInt(total_legacy);
            const migrated = parseInt(migrated_count);
            const completed = parseInt(completed_count);

            const rowStr = "|" + [
                ` ${String(region_name).substring(0, 24)}`.padEnd(colWidths[0]),
                ` ${legacy}`.padEnd(colWidths[1]),
                ` ${migrated}`.padEnd(colWidths[2]),
                ` ${completed}`.padEnd(colWidths[3]),
                ` ${reg_percentage}%`.padEnd(colWidths[4]),
                ` ${comp_percentage}%`.padEnd(colWidths[5])
            ].join("|") + "|";
            
            console.log(rowStr);
            
            grandLegacy += legacy;
            grandMigrated += migrated;
            grandCompleted += completed;
        }

        console.log(border);

        // Grand Total
        const totalRegPct = grandLegacy > 0 ? ((grandMigrated / grandLegacy) * 100).toFixed(2) : "0.00";
        const totalCompPct = grandLegacy > 0 ? ((grandCompleted / grandLegacy) * 100).toFixed(2) : "0.00";

        const footerRow = "|" + [
            " GRAND TOTAL".padEnd(colWidths[0]),
            ` ${grandLegacy}`.padEnd(colWidths[1]),
            ` ${grandMigrated}`.padEnd(colWidths[2]),
            ` ${grandCompleted}`.padEnd(colWidths[3]),
            ` ${totalRegPct}%`.padEnd(colWidths[4]),
            ` ${totalCompPct}%`.padEnd(colWidths[5])
        ].join("|") + "|";
        
        console.log(footerRow);
        console.log(border);

    } catch (err) {
        console.error("CRITICAL: Regional audit failed:", err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
