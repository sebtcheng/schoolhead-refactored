module.exports = {
  apps: [
    {
      name: 'insighted-schoolhead-backend',
      script: 'apps/school-head/api/index.js',
      cwd: '/var/www/html/InsightED-SchoolHead/insighted-schoolhead',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5010
      },
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=2048',
      error_file: '/var/www/html/InsightED-SchoolHead/insighted-schoolhead/logs/error.log',
      out_file: '/var/www/html/InsightED-SchoolHead/insighted-schoolhead/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'insighted-siif-backend',
      script: 'apps/siif/api/index.js',
      cwd: '/var/www/html/InsightED-SchoolHead/insighted-schoolhead',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5015
      },
      max_memory_restart: '1G',
      error_file: '/var/www/html/InsightED-SchoolHead/insighted-schoolhead/logs/siif-error.log',
      out_file: '/var/www/html/InsightED-SchoolHead/insighted-schoolhead/logs/siif-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
