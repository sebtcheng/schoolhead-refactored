import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect().then(async () => {
    try {
        await client.query("SET SESSION internal.authorized_app_deletion = 'true'");
        // Find the submission for this school
        const subRes = await client.query("SELECT siif_sub_id FROM siif_submissions WHERE school_id = '999163'");
        if (subRes.rows.length > 0) {
            const subId = subRes.rows[0].siif_sub_id;
            
            // Find interventions
            const intRes = await client.query('SELECT siif_int_id FROM siif_interventions WHERE siif_sub_id = $1', [subId]);
            const intIds = intRes.rows.map(r => r.siif_int_id);
            
            if (intIds.length > 0) {
                // Delete utilizations for these interventions
                const delRes = await client.query('DELETE FROM siif_utilization WHERE siif_int_id = ANY($1::int[])', [intIds]);
                console.log(`Deleted ${delRes.rowCount} utilization records to fix FK constraint.`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        client.end();
    }
});
