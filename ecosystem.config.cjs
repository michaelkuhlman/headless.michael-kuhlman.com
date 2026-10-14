// pm2 process for https://headless.michael-kuhlman.com (nginx proxies 443 -> 127.0.0.1:3030).
// Secrets are NOT in this file: node loads /etc/headless.env (HEADLESS_REVALIDATE_SECRET etc.) via --env-file.
// Blue/green builds: ~/bin/hl-deploy builds into the idle slot (.next-a / .next-b, named in .next-active)
// and then reloads with NEXT_DIST_DIR pointing at it, so a build never touches the folder being served.
const fs = require('fs');
const path = require('path');
const cwd = '/var/www/headless.michael-kuhlman.com';
let dist = '.next';
try {
  dist = fs.readFileSync(path.join(cwd, '.next-active'), 'utf8').trim() || '.next';
} catch {}

module.exports = {
  apps: [
    {
      name: 'headless-site',
      cwd,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3030 -H 127.0.0.1',
      node_args: '--env-file=/etc/headless.env',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      // sharp image resizing plus prefetch bursts reach 600-850 MB; the box has ~9 GB free
      max_memory_restart: '1536M',
      env: { NODE_ENV: 'production', NEXT_DIST_DIR: dist },
    },
  ],
};
