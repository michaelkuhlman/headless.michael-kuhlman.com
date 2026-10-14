import { revalidateTag } from 'next/cache';
import { after } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getAllProductKeys, getCategories } from '@/lib/magento/catalog';

/**
 * Magento -> headless cache invalidation. The ThirdShot_Headless module POSTs {tags:[...]} signed with
 * HMAC-SHA256 (header X-Signature) using the shared secret in HEADLESS_REVALIDATE_SECRET.
 * It then re-warms every page locally and purges this host at Cloudflare (CF_API_TOKEN / CF_ZONE_ID in /etc/headless.env).
 * Magento cache tags map to ours: cat_p* -> catalog, cat_c* -> catalog, cms_* -> cms, anything else -> both.
 */
export async function POST(req: Request) {
  const secret = process.env.HEADLESS_REVALIDATE_SECRET;
  if (!secret) return Response.json({ ok: false, message: 'not configured' }, { status: 503 });
  const body = await req.text();
  if (body.length > 256_000) return Response.json({ ok: false }, { status: 413 });
  const sig = req.headers.get('x-signature') ?? '';
  const want = createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ ok: false }, { status: 401 });

  let tags: string[] = [];
  try {
    const j = JSON.parse(body) as { tags?: unknown };
    if (Array.isArray(j.tags)) tags = j.tags.filter((t): t is string => typeof t === 'string').slice(0, 500);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const ours = new Set<string>();
  for (const t of tags) {
    if (/^cat_[pc]/i.test(t) || /^catalog/i.test(t) || /^eav/i.test(t)) ours.add('catalog');
    else if (/^cms_/i.test(t)) ours.add('cms');
    else if (/^(config|store|mage)/i.test(t)) { ours.add('catalog'); ours.add('cms'); }
  }
  if (tags.length && !ours.size) { ours.add('catalog'); ours.add('cms'); }
  // Stale-while-revalidate ('max'): the next request regenerates in the background. So after answering, request every
  // storefront page once locally (that triggers the regeneration), give it a moment, and only then purge Cloudflare,
  // so the edge never re-caches a stale render. ({ expire: 0 } would turn the pages into no-store dynamic renders.)
  for (const t of ours) revalidateTag(t, 'max');
  if (ours.size) after(refresh);
  return Response.json({ ok: true, revalidated: [...ours] });
}

let running: Promise<void> | null = null;
let again = false;
/** Warm every page, then purge the edge; calls arriving while one runs are folded into one more pass. */
function refresh(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await new Promise((r) => setTimeout(r, 1500)); // let a burst of admin cache events settle
      await warm();
      await new Promise((r) => setTimeout(r, 2500));
      await warm();
      await purgeEdge();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function warm(): Promise<void> {
  const base = `http://127.0.0.1:${process.env.PORT || 3030}`;
  const get = (u: string) => fetch(base + u, { signal: AbortSignal.timeout(15000) }).then((r) => r.arrayBuffer()).catch(() => null);
  const paths = new Set<string>(['/', '/about', '/faq', '/shipping-returns', '/privacy-policy-cookie-restriction-mode', '/search/term/popular', '/contact']);
  try {
    const [cats, keys] = await Promise.all([getCategories(), getAllProductKeys()]);
    for (const c of cats) paths.add(`/${c.url_path}.html`);
    for (const k of keys) paths.add(`/${k}.html`);
  } catch {
    /* the fixed pages still get warmed */
  }
  const list = [...paths];
  for (let i = 0; i < list.length; i += 6) await Promise.all(list.slice(i, i + 6).map(get));
}

/** Drop this hostname from Cloudflare's edge cache (HTML pages are cached there for up to an hour). */
async function purgeEdge(): Promise<boolean> {
  const token = process.env.CF_API_TOKEN;
  const zone = process.env.CF_ZONE_ID;
  if (!token || !zone) return false;
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ hosts: ['headless.michael-kuhlman.com'] }),
      signal: AbortSignal.timeout(5000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
