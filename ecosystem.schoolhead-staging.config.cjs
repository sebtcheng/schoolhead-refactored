module.exports = {
  apps: [
    {
      name: 'insighted-schoolhead-backend',
      script: 'apps/school-head/api/index.js',
      cwd: '/mnt/www/InsightEd-Mobile-PWA/insighted-schoolhead',
      env: {
        NODE_ENV: 'production',
        PORT: 5010,
      },
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      node_args: '--max-old-space-size=4096',
      error_file: '/mnt/www/InsightEd-Mobile-PWA/insighted-schoolhead/logs/error.log',
      out_file: '/mnt/www/InsightEd-Mobile-PWA/insighted-schoolhead/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }
  ]
};
