module.exports = {
  apps: [
    {
      name: "insighted-staging",
      script: "/var/www/html/InsightEd-Staging/api/index.js",
      cwd: "/var/www/html/InsightEd-Staging",
      watch: false,
      instances: 2,
      exec_mode: "cluster",
      env: {
        PORT: 5001,
        NODE_ENV: "staging",
        UPLOAD_DIR: "/mnt/esf7_draft",
        START_SERVER: "true"
      },
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      max_memory_restart: '1G'
    },
    {
      name: "insighted-backend",
      script: "api/index.js",
      watch: false,
      instances: 6,
      exec_mode: "cluster",
      env: {
        PORT: 5000,
        NODE_ENV: "production",
        UPLOAD_DIR: "/tmp/insighted-pdf-tmp"
      },
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      max_memory_restart: '1G'
    },
    {
      name: "esf7-scheduler",
      script: "/var/www/html/InsightEd-Staging/api/scripts/schedule_harvester.js",
      cwd: "/var/www/html/InsightEd-Staging",
      watch: false,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "staging",
        START_SERVER: "true"
      }
    }


  ]
};
