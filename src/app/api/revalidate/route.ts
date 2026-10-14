import { revalidateTag } from 'next/cache';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Magento -> headless cache invalidation. The ThirdShot_Headless module POSTs {tags:[...]} signed with
 * HMAC-SHA256 (header X-Signature) using the shared secret in HEADLESS_REVALIDATE_SECRET.
 * Magento cache tags map to ours: cat_p* -> catalog, cat_c* -> catalog, cms_* -> cms, anything else -> both.
 */
export async function POST(req: Request) {
  const secret = process.env.HEADLESS_REVALIDATE_SECRET;
  if (!secret) return Response.json({ ok: false, message: 'not configured' }, { status: 503 });
  const body = await req.text();
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
  for (const t of ours) revalidateTag(t, 'max');
  return Response.json({ ok: true, revalidated: [...ours] });
}
