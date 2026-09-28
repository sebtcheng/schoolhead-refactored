import { poolSiif } from '../packages/shared-db/src/db.js';

async function test() {
    try {
        const res = await poolSiif.query(
            'SELECT modi_siif_util_id, school_id, selected_interventions, utilization_data FROM modified_siif_utilization WHERE school_id = $1',
            ['800009']
        );
        console.log('Record for school 800009:');
        console.log(JSON.stringify(res.rows[0], null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}

test();
