import { getProductsByUrlKeys } from '@/lib/magento/catalog';

/** Product cards by url_key (Saved list, Recently viewed, bag "Pairs well with"). */
export async function GET(req: Request) {
  const keys = (new URL(req.url).searchParams.get('keys') ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => /^[a-z0-9-]{1,120}$/.test(k))
    .slice(0, 60);
  if (!keys.length) return Response.json({ items: [] });
  try {
    const items = await getProductsByUrlKeys([...new Set(keys)].sort());
    const by = new Map(items.map((p) => [p.url_key, p]));
    return Response.json({ items: keys.map((k) => by.get(k)).filter(Boolean) }, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch {
    return Response.json({ items: [] }, { status: 502 });
  }
}
