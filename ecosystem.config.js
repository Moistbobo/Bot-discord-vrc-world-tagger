module.exports = {
  apps: [
    {
      name: 'world-tagger-man',
      script: 'dist/index.js',
      cwd: '/home/world-tagger/Bot-discord-vrc-world-tagger',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      },
      log_file: '/home/world-tagger/.pm2/logs/world-tagger-man.log',
      out_file: '/home/world-tagger/.pm2/logs/world-tagger-man.log',
      error_file: '/home/world-tagger/.pm2/logs/world-tagger-man.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};
