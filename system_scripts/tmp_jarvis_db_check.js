import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ 
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function getStats() {
  const stats = {};
  try {
    // DB Size
    const sizeRes = await pool.query("SELECT pg_size_pretty(pg_database_size('insightEd')) as size;");
    stats.dbSize = sizeRes.rows[0].size;

    // Connections
    const connRes = await pool.query("SELECT count(*) as count FROM pg_stat_activity;");
    stats.activeConnections = parseInt(connRes.rows[0].count);

    // Table stats
    const tableRes = await pool.query("SELECT count(*) as count FROM pg_class WHERE relkind = 'r' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');");
    stats.tableCount = parseInt(tableRes.rows[0].count);

    // Cache hit ratio
    const cacheRes = await pool.query("SELECT (sum(heap_blks_hit) * 100.0 / (NULLIF(sum(heap_blks_read) + sum(heap_blks_hit), 0))) as ratio FROM pg_statio_user_tables;");
    stats.cacheHitRatio = cacheRes.rows[0].ratio ? parseFloat(cacheRes.rows[0].ratio).toFixed(2) + '%' : 'N/A';

    console.log(JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error('Error fetching DB stats:', err.message);
  } finally {
    const startSize = stats.dbSize ? parseFloat(stats.dbSize.split(' ')[0]) : 0;
    // Simulate some logic for storage growth assessment (fake since no history yet)
    stats.predictedGrowthPerDay = "0.05GB"; // Placeholder for assessment logic
    await pool.end();
  }
}

getStats();
