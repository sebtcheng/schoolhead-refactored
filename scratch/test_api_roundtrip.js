import { poolSiif } from '../packages/shared-db/src/db.js';

async function testQuery() {
    const client = await poolSiif.connect();
    try {
        const { rows } = await client.query(
            `SELECT modi_siif_util_id, school_id, siif_allocation_id, fiscal_year, 
                    allocation_amount, selected_interventions, updated_at
             FROM modified_siif_utilization
             WHERE school_id = $1 AND fiscal_year = $2
             LIMIT 1`,
            ['800009', 2026]
        );
        console.log('✅ Fetch test succeeded! Record:');
        console.log(JSON.stringify(rows[0], null, 2));
    } finally {
        client.release();
        process.exit(0);
    }
}

testQuery();
