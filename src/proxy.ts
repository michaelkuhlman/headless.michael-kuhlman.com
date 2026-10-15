import { NextResponse, type NextRequest } from 'next/server';
import { magento } from '@/lib/magento/client';

/*
 * Real 404s for unknown store URLs. With cacheComponents the catch-all route streams its static shell before
 * notFound() can run, so the status would be 200. Here, paths that fall through to [...slug] are checked against
 * Magento's `route` resolver first (cached in memory per process; known paths cost a Map lookup).
 */

const APP_PREFIXES = ['checkout', 'customer', 'catalogsearch', 'saved', 'contact', 'sales', 'search', 'newsletter', 'page-not-found'];
// The app's own pages under those prefixes (src/app/**/page.tsx). Anything else there, /checkout/xyz say, used to
// render the error shell with a 200; now it gets the 404 page with a 404 status. Add new app pages here.
const APP_PATHS = new Set([
  '/catalogsearch/result', '/checkout', '/checkout/cart', '/checkout/onepage/success', '/contact',
  '/customer/account', '/customer/account/create', '/customer/account/edit', '/customer/account/forgotpassword',
  '/customer/account/login', '/customer/account/logout', '/customer/address', '/newsletter/manage', '/page-not-found',
  '/sales/guest/form', '/sales/order/history', '/sales/order/view', '/saved', '/search/term/popular',
]);
// Files in public/ (served by Next itself). Everything else goes through the checks below; the matcher used to skip
// any path merely starting with "logo", "favicon" or "sitemap", so e.g. /sitemap-123.xml answered 200 once.
const PUBLIC_FILES = new Set(['/favicon.svg', '/apple-touch-icon.png', '/logo.svg', '/logo-light.svg', '/mark.svg', '/mark-light.svg', '/robots.txt']);
const TTL_OK = 10 * 60_000;
const TTL_MISS = 60_000;
const seen = new Map<string, { ok: boolean; at: number }>();

async function exists(url: string): Promise<boolean> {
  const hit = seen.get(url);
  if (hit && Date.now() - hit.at < (hit.ok ? TTL_OK : TTL_MISS)) return hit.ok;
  let ok = true;
  try {
    const d = await magento<{ route: { type: string } | null }>(`query R($u:String!){route(url:$u){type relative_url}}`, { u: url }, { timeoutMs: 4000 });
    ok = !!d.route;
  } catch {
    // Magento hiccup: let the page itself decide rather than 404 a real URL, and do not remember the guess
    return true;
  }
  if (seen.size > 5000) seen.clear();
  seen.set(url, { ok, at: Date.now() });
  return ok;
}

// Next drops a rewrite's status for app routes, so the prerendered 404 page is fetched once over loopback and
// served with a real 404 status.
let nf: { html: string; at: number } | null = null;
async function notFoundHtml(): Promise<string> {
  if (nf && Date.now() - nf.at < TTL_OK) return nf.html;
  const port = process.env.PORT || '3030';
  const r = await fetch(`http://127.0.0.1:${port}/page-not-found`, { cache: 'no-store' });
  const html = await r.text();
  if (r.ok) nf = { html, at: Date.now() };
  return html;
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const first = path.split('/')[1] ?? '';
  if (!first || PUBLIC_FILES.has(path)) return NextResponse.next();
  if (APP_PREFIXES.includes(first)) {
    // trailing-slash variants are redirected by Next itself, so compare without it
    return APP_PATHS.has(path.replace(/\/+$/, '')) ? NextResponse.next() : notFoundResponse();
  }
  const url = path.slice(1).replace(/\/$/, '');
  if (!/^[a-z0-9\-_./]{1,200}$/i.test(url) || !(await exists(url))) return notFoundResponse();
  return NextResponse.next();
}

async function notFoundResponse(): Promise<NextResponse> {
  return new NextResponse(await notFoundHtml(), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate' } });
}

export const config = {
  matcher: ['/((?!_next/|api/|icons/|fonts/).*)'],
};
