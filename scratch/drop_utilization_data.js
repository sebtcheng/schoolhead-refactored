import { poolSiif } from '../packages/shared-db/src/db.js';

async function dropColumn() {
    console.log('🗑️ Dropping redundant utilization_data column from modified_siif_utilization...');
    const client = await poolSiif.connect();
    try {
        await client.query('BEGIN');

        await client.query('ALTER TABLE public.modified_siif_utilization DROP COLUMN IF EXISTS utilization_data;');

        await client.query('COMMIT');
        console.log('✅ Column utilization_data successfully dropped!');

        // Verify remaining columns
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'modified_siif_utilization'
            ORDER BY ordinal_position;
        `);

        console.log('\n📋 Current columns in modified_siif_utilization:');
        res.rows.forEach(col => console.log(`  - ${col.column_name} (${col.data_type})`));
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔥 Failed to drop column:', err);
    } finally {
        client.release();
        process.exit(0);
    }
}

dropColumn();
