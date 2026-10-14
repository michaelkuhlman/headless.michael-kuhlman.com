# headless.michael-kuhlman.com - headless Magento 2 storefront

Next.js 16 (App Router, Cache Components, Partial Prefetching, Turbopack) + TypeScript + plain CSS, talking to the
Mage-OS store at https://m2.michael-kuhlman.com over GraphQL. Same catalogue, images, CMS content and design as the
classic Luma-based theme there (ThirdShot), so the two demo stores can be compared side by side for speed.

## Run / deploy
- pm2 process `headless-site` (`ecosystem.config.cjs`): `next start` on 127.0.0.1:3030, env from `/etc/headless.env`
  (root:kai 640; holds `HEADLESS_REVALIDATE_SECRET`, never commit or print it). nginx 443 block in
  `/etc/nginx/sites-available/headless.michael-kuhlman.com` proxies to it; Cloudflare DNS `headless` is proxied.
- Deploy = `~/bin/hl-deploy` (`npx tsc --noEmit` first: zero TS errors). Blue/green: it builds into the idle slot
  (`.next-a` / `.next-b`, the live one is named in `.next-active`), reloads pm2 onto it through `ecosystem.config.cjs`
  (`NEXT_DIST_DIR`), purges this host at Cloudflare and warms the main pages. `hl-deploy --rollback` swaps back,
  `--no-build` just reloads. Never `npx next build` into `.next*` that is live, never a bare `pm2 restart`.
- pm2 from a Claude session: always `env -i HOME=$HOME PATH=$PATH PM2_HOME=$HOME/.pm2 pm2 ...` (hl-deploy does).
  Sessions spawned under pm2 inherit `max_memory_restart=524288000` and nexus secrets in their env, and the pm2 CLI
  copies both into any app it starts (that capped this app at 500 MB and caused restart storms on 2026-10-13).
  The real limit is 1536M (sharp + prefetch bursts reach 600-850 MB).
- Magento -> headless invalidation: `/api/revalidate` is called by the m2 module on 127.0.0.1:3030; nginx 404s it publicly.
  `NODE_ENV=production` is exported on this box, so `npm ci --include=dev`.

## Git
- `hlgit` (`~/bin/hlgit`, repo in `~/backups/headless/site.git`, work tree = this dir). Local only, no GitHub remote yet
  (the box's gh token cannot create repos; Michael would create `michaelkuhlman/headless.michael-kuhlman.com`).
- Commit files by name, never `add -A`, never force/stash/reset/clean here. `.githooks/pre-commit` blocks secrets.

## Architecture
- `src/app/[...slug]/page.tsx`: every product / category / CMS URL (same URLs as m2) via GraphQL `route`; all
  prerendered at build (`generateStaticParams`), refreshed by `'use cache'` + `cacheTag` and `/api/revalidate`.
- `src/proxy.ts`: real 404 status for unknown URLs (cacheComponents streams the shell before `notFound()`).
- `src/lib/magento/`: server GraphQL client pinned to 127.0.0.1 (GET for catalogue reads so Magento's FPC caches
  them), catalogue queries, types. Browser calls go through `/api/*` route handlers, never straight to Magento.
- Client state (cart id, saved, recently viewed, searches) in localStorage; customer token in httpOnly `hl_token`.
- Styles: `src/styles/*.css`, ported from the m2 theme LESS with the same `ts-*` class names. Design changes here
  that are drastic should be mirrored on m2 (and vice versa) so the two stay nearly identical.
- Product cards / widget grids in CMS content are rendered by `CmsContent.tsx` (html-react-parser).
