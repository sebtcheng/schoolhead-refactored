
import pkg from 'pg';
const { Client } = pkg;

async function executeCleanup() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
        ssl: false
    });

    try {
        await client.connect();
        console.log("🚀 Starting cleanup of test schools...");

        await client.query('BEGIN');
        
        // 1. Authorize deletion bypasses
        await client.query("SET LOCAL internal.authorized_app_deletion = 'true'");
        await client.query("SET LOCAL app.allow_deletions = 'true'");
        console.log("🛡️ Deletion bypasses authorized (both internal and app).");

        // 2. Identify schools to delete
        const cols = [
            'head_first_name', 'head_middle_name', 'head_last_name', 
            'head_sex', 'head_position_title', 'head_date_of_birth'
        ];
        const whereClause = cols.map(col => {
            if (col === 'head_date_of_birth') return `("${col}" IS NULL)`;
            return `("${col}" IS NULL OR "${col}" = '')`;
        }).join(' AND ');
        
        const identifyQuery = `SELECT school_id, iern FROM ph_schools WHERE school_id::text LIKE '999%' AND ${whereClause}`;
        const identifyRes = await client.query(identifyQuery);
        const targetIds = identifyRes.rows.map(r => r.school_id);
        const targetIerns = identifyRes.rows.map(r => r.iern);

        console.log(`📊 Found ${targetIds.length} blank test schools to clean up.`);

        if (targetIds.length > 0) {
            // 3. Delete from users
            const deleteUsersRes = await client.query(`DELETE FROM users WHERE school_id IN (${targetIds.map((_, i) => '$' + (i + 1)).join(',')})`, targetIds);
            console.log(`✅ Deleted ${deleteUsersRes.rowCount} associated user accounts.`);

            // 4. Delete from ph_schools
            const deletePhRes = await client.query(`DELETE FROM ph_schools WHERE school_id IN (${targetIds.map((_, i) => '$' + (i + 1)).join(',')})`, targetIds);
            console.log(`✅ Deleted ${deletePhRes.rowCount} records from ph_schools.`);
        }

        // 5. Cleanup Ghost Users (Schools in users but NOT in ph_schools)
        const ghostQuery = `
            SELECT school_id FROM users 
            WHERE school_id::text LIKE '999%' 
            AND school_id NOT IN (SELECT school_id FROM ph_schools WHERE school_id IS NOT NULL)
        `;
        const ghostRes = await client.query(ghostQuery);
        const ghostIds = ghostRes.rows.map(r => r.school_id);
        
        console.log(`👻 Found ${ghostIds.length} ghost test users to clean up.`);
        if (ghostIds.length > 0) {
            const deleteGhostsRes = await client.query(`DELETE FROM users WHERE school_id IN (${ghostIds.map((_, i) => '$' + (i + 1)).join(',')})`, ghostIds);
            console.log(`✅ Deleted ${deleteGhostsRes.rowCount} ghost user accounts.`);
        }

        await client.query('COMMIT');
        console.log("🏁 Cleanup committed successfully.");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Cleanup failed and rolled back:", err.message);
    } finally {
        await client.end();
    }
}

executeCleanup();
