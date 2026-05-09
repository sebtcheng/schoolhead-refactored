
import pkg from 'pg';
const { Client } = pkg;

async function checkUsersForBlankSchools() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
        ssl: false
    });

    try {
        await client.connect();

        // Find blank schools first
        const cols = [
            'head_first_name', 'head_middle_name', 'head_last_name', 
            'head_sex', 'head_position_title', 'head_date_of_birth'
        ];
        const whereClause = cols.map(col => {
            if (col === 'head_date_of_birth') return `("${col}" IS NULL)`;
            return `("${col}" IS NULL OR "${col}" = '')`;
        }).join(' AND ');
        
        const phRes = await client.query(`SELECT school_id FROM ph_schools WHERE school_id::text LIKE '999%' AND ${whereClause}`);
        const blankIds = phRes.rows.map(r => r.school_id);
        console.log(`Found ${blankIds.length} blank test schools.`);

        if (blankIds.length > 0) {
            const userRes = await client.query(`SELECT school_id, COUNT(*) as count FROM users WHERE school_id IN (${blankIds.map((_, i) => '$' + (i + 1)).join(',')}) GROUP BY school_id`, blankIds);
            console.log(`Found users for ${userRes.rows.length} of these schools.`);
            if (userRes.rows.length > 0) {
                console.log("First 5 schools with users:", userRes.rows.slice(0, 5));
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkUsersForBlankSchools();
