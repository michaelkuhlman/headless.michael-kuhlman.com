# headless.michael-kuhlman.com - headless Magento 2 storefront

Next.js 16 (App Router, Cache Components, Partial Prefetching, Turbopack) + TypeScript + plain CSS, talking to the
Mage-OS store at https://m2.michael-kuhlman.com over GraphQL. Same catalogue, images, CMS content and design as the
classic Luma-based theme there (ThirdShot), so the two demo stores can be compared side by side for speed.

## Run / deploy
- pm2 process `headless-site` (`ecosystem.config.cjs`): `next start` on 127.0.0.1:3030, env from `/etc/headless.env`
  (root:kai 640; holds `HEADLESS_REVALIDATE_SECRET`, never commit or print it). nginx 443 block in
  `/etc/nginx/sites-available/headless.michael-kuhlman.com` proxies to it; Cloudflare DNS `headless` is proxied.
- Deploy = `~/bin/hl-deploy` (a symlink to the tracked `deploy/hl-deploy`; `npx tsc --noEmit` first: zero TS errors).
  It first brings this tree level with GitHub (merges the laptop's pushes, pushes the server's own commits), then
  blue/green: it builds into the idle slot (`.next-a` / `.next-b`, the live one is named in `.next-active`), reloads
  pm2 onto it through `ecosystem.config.cjs` (`NEXT_DIST_DIR`), purges this host at Cloudflare, warms the main pages
  and lists the uncommitted files it just put live. `hl-deploy --rollback` swaps back, `--no-build` just reloads,
  `--sync-only` does only the GitHub step. Never `npx next build` into `.next*` that is live, never a bare
  `pm2 restart`.
- pm2 from a Claude session: always `env -i HOME=$HOME PATH=$PATH PM2_HOME=$HOME/.pm2 pm2 ...` (hl-deploy does).
  Sessions spawned under pm2 inherit `max_memory_restart=524288000` and nexus secrets in their env, and the pm2 CLI
  copies both into any app it starts (that capped this app at 500 MB and caused restart storms on 2026-10-13).
  The real limit is 1536M (sharp + prefetch bursts reach 600-850 MB).
- Magento -> headless invalidation: `/api/revalidate` is called by the m2 module on 127.0.0.1:3030; nginx 404s it publicly.
  `NODE_ENV=production` is exported on this box, so `npm ci --include=dev`.

## Git and GitHub
This site is written entirely by AI (Claude Code sessions on this server and on Michael's laptop); nobody edits files
or runs git by hand, and Michael only looks at the result now and then. So git is the only record of what changed and
why: every change is a commit, and every commit is on GitHub within seconds.

- **GitHub**: private `michaelkuhlman/headless.michael-kuhlman.com`
  (https://github.com/michaelkuhlman/headless.michael-kuhlman.com), one branch `main`, no PRs. It is the off-site copy
  and the channel to the laptop clone. No CI on purpose: the build prerenders every page from the m2 store on this
  box, and the account's Actions minutes go to michael-kuhlman.com; the hooks below run the checks instead.
  Dependabot security alerts are on (`gh api repos/michaelkuhlman/headless.michael-kuhlman.com/dependabot/alerts`);
  automatic Dependabot PRs are off (nobody merges PRs here).
- **On this server git is `hlgit`** (`~/bin/hlgit`): `GIT_DIR=/home/kai/backups/headless/site.git`, this directory as
  the work tree, so nothing under `/var/www` can serve repository internals. Plain `git` here says "not a git
  repository": expected, never `git init`. Push/pull use the repo-only deploy key `~/.ssh/id_hl_github` via the ssh
  alias `github.com-hl` (`ssh -T git@github.com-hl` answers "Hi michaelkuhlman/headless.michael-kuhlman.com!").
- **The work tree IS the live site's source**, and `hl-deploy` builds it as it is, uncommitted edits included.
  Nothing is live until it is deployed, and nothing is done until it is committed.
- **Every change, in order:**
  1. `hlgit pull --ff-only` before you start. If it refuses, the laptop pushed while this tree has unpushed commits:
     run `~/bin/hl-deploy --sync-only`, which merges and pushes.
  2. Edit; `npx tsc --noEmit` clean; `~/bin/hl-deploy`; check the pages you touched in a browser.
  3. `hlgit add <the files you touched>` **by name**, then `hlgit commit -m "<what changed and why>"` with the trailer
     your harness gives you. Never `add -A` / `add .` / `commit -a`: other sessions keep live, uncommitted work in
     this same tree, and it is theirs to commit. Commit your own work before you finish; `hl-deploy` lists what is
     live but uncommitted.
  4. The post-commit hook pushes to GitHub by itself and prints `pushed to GitHub`. If it prints `AUTO-PUSH FAILED`
     (the laptop pushed first), run `~/bin/hl-deploy --sync-only`.
- **Commits**: one logical change each. Subject = what changed, in the imperative, under ~72 characters ("Fix the bag
  drawer focus trap on iOS"); body = why, plus anything the next session must know. Later sessions learn the site's
  history from `hlgit log`, so write for them.
- **Hooks** live in `.githooks/` (tracked; active through `core.hooksPath` here and in every clone):
  - `pre-commit` checks the STAGED files and blocks: token-shaped secrets and the real values from `/etc/headless.env`
    and the Cloudflare env; credential, database and dump files; leftovers (`.bak .old .orig .rej .save .swp .tmp`);
    `node_modules/`, `.next*/` and other build output; files over 5 MB; merge-conflict markers; hooks or
    `deploy/hl-deploy` without the executable bit; invalid JSON / YAML / XML / SVG; Python, shell and JavaScript
    syntax errors; TypeScript errors **in the files being committed** (errors elsewhere in the tree are only a
    warning: usually another session's unfinished work). Fix, re-stage, commit again. Never `--no-verify`.
    Whole-tree audit: `HL_PRECOMMIT_ALL=1 hlgit hook run pre-commit`.
  - `post-commit` / `post-merge` / `post-rewrite` push `main`; `HL_NO_AUTOPUSH=1` skips once.
  - `pre-push` refuses force-pushes and branch deletions. GitHub's free plan has no branch protection for private
    repos, so this hook is the protection.
- **Never** `--force`, never amend or rebase a pushed commit, never `stash` / `reset --hard` / `checkout -- <file>` /
  `restore` / `clean` in this tree: uncommitted changes here are somebody's live work. Undo with `hlgit revert <sha>`,
  then `hl-deploy`.
- **`.gitignore`** keeps out dependencies, the build slots, secrets, databases, logs and reports, and leftovers, in
  commented sections. A file you need shows as ignored? `hlgit check-ignore -v <path>` names the rule: change the
  rule, never `add -f`. `.gitattributes` forces LF line endings everywhere, the Windows laptop included.
- **Not in git**: secrets (`/etc/headless.env`: the revalidate secret and the Cloudflare token), the nginx vhost,
  Cloudflare rules (pre-change backups in `~/backups/headless/`), the build slots and `node_modules`.
- **Laptop clone**: `C:\xampp\htdocs\headless.michael-kuhlman.com` (source only, no `node_modules`, so its pre-commit
  skips the TypeScript check). Commit there (the hooks run and auto-push), then `ssh atlas bin/hl-deploy` to put it
  live. A refused push there: `git pull --rebase origin main` (safe on the laptop, never on this server).

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
