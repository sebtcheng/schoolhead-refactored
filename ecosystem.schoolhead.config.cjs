module.exports = {
  apps: [
    {
      name: 'insighted-schoolhead-backend',
      script: 'api/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5010,
        // Override any needed env vars here
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '800M',
      node_args: '--max-old-space-size=1024',
      error_file: 'logs/schoolhead-error.log',
      out_file: 'logs/schoolhead-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }
  ]
};
