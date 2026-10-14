import { listProducts, type SortKey } from '@/lib/magento/catalog';

/**
 * Category / search listing with filters, used by the instant (no reload) filtering UI.
 * ?cat=<uid>&q=<search>&sort=position|name|price&dir=ASC|DESC&price=10-50&color=26,27&...
 */
const RESERVED = new Set(['cat', 'q', 'sort', 'dir', 'price', 'p']);

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const filters: Record<string, string[]> = {};
  for (const [k, v] of sp.entries()) {
    if (Object.keys(filters).length >= 10) break; // bounded work per request
    if (RESERVED.has(k) || !/^[a-z0-9_]{1,40}$/.test(k)) continue;
    const vals = v.split(',').filter((x) => /^[A-Za-z0-9=_-]{1,40}$/.test(x)).slice(0, 20).sort();
    if (vals.length) filters[k] = vals;
  }
  let price: { from?: number; to?: number } | null = null;
  const pr = sp.get('price');
  if (pr && /^\d*(\.\d+)?-\d*(\.\d+)?$/.test(pr)) {
    const [a, b] = pr.split('-');
    price = { ...(a ? { from: Number(a) } : {}), ...(b ? { to: Number(b) } : {}) };
  }
  const sortRaw = sp.get('sort');
  const sort = (['position', 'name', 'price', 'relevance'] as const).includes(sortRaw as SortKey) ? (sortRaw as SortKey) : undefined;
  const dir = sp.get('dir') === 'DESC' ? 'DESC' : sp.get('dir') === 'ASC' ? 'ASC' : undefined;
  const cat = sp.get('cat') ?? undefined;
  const q = sp.get('q')?.trim().slice(0, 80) || undefined;
  if (!cat && !q) return Response.json({ error: 'cat or q required' }, { status: 400 });
  try {
    const res = await listProducts({ categoryUid: cat, search: q?.toLowerCase(), filters, price, sort, dir, pageSize: 60 });
    return Response.json(res, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch {
    return Response.json({ error: 'Store unavailable' }, { status: 502 });
  }
}
