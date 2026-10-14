# Third Shot Supply Co. (headless storefront)

Live: **https://headless.michael-kuhlman.com** · the classic Magento theme it mirrors: https://m2.michael-kuhlman.com

A headless front end for the Third Shot Supply Co. demo store, a fictional premium pickleball brand. Same catalogue,
images, CMS content and design as the Luma-based theme on m2.michael-kuhlman.com, rebuilt in Next.js over Magento's
GraphQL API so the two stores can be compared side by side for speed. It is a demo: no real orders, payments or
shipping.

Written and run entirely by AI (Claude Code). The working rules for agents (git, deploy, architecture) are in
[CLAUDE.md](CLAUDE.md).

## Stack

- Next.js 16 (App Router, Cache Components, Partial Prefetching, Turbopack), React 19, TypeScript, plain CSS
- Mage-OS 3.5 (Magento 2.4.9) over GraphQL. Every product, category and CMS page is prerendered at build time and
  refreshed by on-demand revalidation when it is saved in Magento.
- pm2 + nginx on a Linux server behind Cloudflare, blue/green deploys

## What is where

| Path | What it is |
|---|---|
| `src/app/` | Routes: the catch-all `[...slug]` serves every product, category and CMS URL (the same URLs as m2); bag, checkout, account, search, saved items; `api/` route handlers |
| `src/components/` | Header, footer, product cards, category listing, product page, quick view, bag drawer, checkout, account |
| `src/lib/magento/` | Server-side GraphQL client, catalogue queries, fragments, types |
| `src/lib/client/` | Browser-side state: cart, sign-in, saved lists, recently viewed |
| `src/styles/` | CSS ported from the m2 theme (same `ts-*` class names), self-hosted Fraunces and Inter |
| `public/` | Logo, favicon, icons |
| `deploy/hl-deploy` | Deploy: GitHub sync, blue/green build, pm2 reload, Cloudflare purge, warm-up |
| `.githooks/` | Commit checks (secrets, syntax, TypeScript, leftovers), auto-push to GitHub, force-push refusal |
