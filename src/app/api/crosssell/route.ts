import { getProduct } from '@/lib/magento/catalog';
import type { ProductCard } from '@/lib/magento/types';

/** "Pairs well with" on the bag page: cross-sells of the bag's products (related as a fallback), minus what is in it. */
export async function GET(req: Request) {
  const keys = (new URL(req.url).searchParams.get('keys') ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => /^[a-z0-9-]{1,120}$/.test(k))
    .slice(0, 12);
  if (!keys.length) return Response.json({ items: [] });
  try {
    const products = (await Promise.all([...new Set(keys)].map((k) => getProduct(k)))).filter((p) => p !== null);
    const inBag = new Set(products.map((p) => p.url_key));
    const out = new Map<string, ProductCard>();
    for (const list of [products.flatMap((p) => p.crosssell_products ?? []), products.flatMap((p) => p.related_products ?? [])]) {
      for (const c of list) if (!inBag.has(c.url_key) && c.stock_status === 'IN_STOCK' && !out.has(c.url_key)) out.set(c.url_key, c);
      if (out.size >= 4) break;
    }
    return Response.json({ items: [...out.values()].slice(0, 4) }, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch {
    return Response.json({ items: [] }, { status: 502 });
  }
}
