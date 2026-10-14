import { getProduct } from '@/lib/magento/catalog';

/** Full product data by url_key (quick view, bag "Pairs well with"). */
export async function GET(req: Request) {
  const key = (new URL(req.url).searchParams.get('key') ?? '').trim();
  if (!/^[a-z0-9-]{1,120}$/.test(key)) return Response.json({ product: null }, { status: 400 });
  try {
    const product = await getProduct(key);
    if (!product) return Response.json({ product: null }, { status: 404 });
    return Response.json({ product }, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch {
    return Response.json({ product: null }, { status: 502 });
  }
}
