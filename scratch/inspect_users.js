
import pkg from 'pg';
const { Client } = pkg;

async function inspectUsersForBlankSchools() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
        ssl: false
    });

    try {
        await client.connect();

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

        if (blankIds.length > 0) {
            const userRes = await client.query(`SELECT uid, email, school_id FROM users WHERE school_id IN (${blankIds.map((_, i) => '$' + (i + 1)).join(',')})`, blankIds);
            console.log("Sample users for blank schools:");
            console.log(userRes.rows.slice(0, 10));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

inspectUsersForBlankSchools();
