module.exports = {
  apps: [
    {
      name: 'lut-action-web',
      script: './dist/server.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
      error_file: '/var/log/pm2/web-error.log',
      out_file: '/var/log/pm2/web-out.log',
      log_file: '/var/log/pm2/web-combined.log',
      time: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      max_memory_restart: '1G',
    },
    {
      name: 'lut-action-worker',
      script: './dist/worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pm2/worker-error.log',
      out_file: '/var/log/pm2/worker-out.log',
      log_file: '/var/log/pm2/worker-combined.log',
      time: true,
      kill_timeout: 30000, // Give worker more time to finish jobs
      max_memory_restart: '2G',
      autorestart: true,
      watch: false,
    },
  ],
};