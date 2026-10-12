// STAGING ONLY — insighted-schoolhead-staging-backend on port 5020.
// Served by Nginx at /insighted-schoolhead-staging/ (upstream schoolhead_staging_backend).
// Deployed by deploy_schoolhead_staging.py. Production uses ecosystem.schoolhead.config.cjs (port 5010).
const ROOT = '/mnt/insighted-schoolhead-staging';

module.exports = {
  apps: [
    {
      name: 'insighted-schoolhead-staging-backend',
      script: 'apps/school-head/api/index.js',
      cwd: `${ROOT}/current`,
      env: {
        NODE_ENV: 'production',
        PORT: 5020,
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1536',
      error_file: `${ROOT}/logs/error.log`,
      out_file: `${ROOT}/logs/out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
