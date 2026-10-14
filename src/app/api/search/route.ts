import { getCategories, listProducts } from '@/lib/magento/catalog';

/** Live search: a few matching products plus matching categories. */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) return Response.json({ q, total: 0, items: [], categories: [] });
  try {
    const [res, cats] = await Promise.all([listProducts({ search: q.toLowerCase(), pageSize: 6 }), getCategories()]);
    const ql = q.toLowerCase();
    const catIds = new Set(res.aggregations.find((a) => a.attribute_code === 'category_uid')?.options.map((o) => o.value) ?? []);
    const categories = cats
      .filter((c) => catIds.has(c.uid) || c.name.toLowerCase().includes(ql))
      .map((c) => ({ name: c.name, url_path: c.url_path }));
    return Response.json(
      { q, total: res.total_count, items: res.items, categories },
      { headers: { 'Cache-Control': 'public, max-age=120' } },
    );
  } catch {
    return Response.json({ q, total: 0, items: [], categories: [], error: true }, { status: 502 });
  }
}
