import { poolSiif } from '../packages/shared-db/src/db.js';

const INTERVENTION_LABELS = {
    remediation: 'Remediation',
    enhancement: 'Enhancement',
    enrichment: 'Enrichment',
    prevention: 'Prevention',
    wellness: 'Wellness',
    learning_environment: 'Learning Environment',
    acceleration: 'Acceleration',
    inclusive: 'Inclusive',
    engagement: 'Engagement',
    behavioral: 'Behavioral',
    instructional_improvement: 'Instructional Improvement',
    technology_enabled: 'Technology-enabled',
};

async function migrate() {
    console.log('🔄 Running migration: Harmonizing modified_siif_utilization to unified selected_interventions...');
    const client = await poolSiif.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query('SELECT modi_siif_util_id, selected_interventions, utilization_data FROM modified_siif_utilization');
        console.log(`Found ${rows.length} rows to inspect.`);

        for (const row of rows) {
            let selected = row.selected_interventions;
            if (typeof selected === 'string') {
                try { selected = JSON.parse(selected); } catch (e) { selected = []; }
            }
            if (!Array.isArray(selected)) selected = [];

            let utilData = row.utilization_data;
            if (typeof utilData === 'string') {
                try { utilData = JSON.parse(utilData); } catch (e) { utilData = {}; }
            }
            if (!utilData || typeof utilData !== 'object') utilData = {};

            // Check if already in unified format (array of objects with id)
            const isAlreadyUnified = selected.length > 0 && typeof selected[0] === 'object' && selected[0]?.id;

            let unifiedInterventions = [];

            if (isAlreadyUnified) {
                console.log(`Row ${row.modi_siif_util_id} is already in unified format.`);
                unifiedInterventions = selected;
            } else {
                // Convert array of string keys to array of detailed objects
                unifiedInterventions = selected.map(intId => {
                    const quarters = utilData[intId] || {
                        'July-September': { amount: '', status: 'Not Yet Started', justification: '' },
                        'October-December': { amount: '', status: 'Not Yet Started', justification: '' },
                        'January-March': { amount: '', status: 'Not Yet Started', justification: '' }
                    };

                    let totalSpent = 0;
                    Object.values(quarters).forEach(q => {
                        const amt = parseFloat(q?.amount !== undefined ? q.amount : q) || 0;
                        totalSpent += amt;
                    });

                    return {
                        id: intId,
                        title: INTERVENTION_LABELS[intId] || intId,
                        quarters,
                        total_spent: totalSpent
                    };
                });

                console.log(`Converting Row ${row.modi_siif_util_id}:`, JSON.stringify(unifiedInterventions, null, 2));

                await client.query(
                    `UPDATE modified_siif_utilization 
                     SET selected_interventions = $1::jsonb, updated_at = NOW() 
                     WHERE modi_siif_util_id = $2`,
                    [JSON.stringify(unifiedInterventions), row.modi_siif_util_id]
                );
            }
        }

        await client.query('COMMIT');
        console.log('✅ Migration successfully applied!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔥 Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
