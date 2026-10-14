// pm2 process for https://headless.michael-kuhlman.com (nginx proxies 443 -> 127.0.0.1:3030).
// Secrets are NOT in this file: node loads /etc/headless.env (HEADLESS_REVALIDATE_SECRET) via --env-file.
module.exports = {
  apps: [
    {
      name: 'headless-site',
      cwd: '/var/www/headless.michael-kuhlman.com',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3030 -H 127.0.0.1',
      node_args: '--env-file=/etc/headless.env',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '700M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
