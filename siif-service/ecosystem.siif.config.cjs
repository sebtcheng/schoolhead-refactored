module.exports = {
  apps: [
    {
      name: 'insighted-siif',
      script: 'api/index.js',
      cwd: '/var/www/html/InsightEd-SchoolHead/siif-service',
      watch: false,
      instances: 2,
      exec_mode: 'cluster',
      env: {
        PORT: 3001,
        NODE_ENV: 'production',
      },
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      max_memory_restart: '512M'
    }
  ]
};
