import type { Product } from '@/lib/magento/types';
import { mediaSrc } from '@/lib/format';
import { SITE_URL } from '@/lib/site';

/**
 * schema.org Product + BreadcrumbList for the product page (the classic store carries Product microdata in Luma's
 * templates). Rendered on the server into the static HTML, so crawlers and link unfurlers read it without JS.
 */
export function ProductJsonLd({ p, category }: { p: Product; category?: { name: string; href: string } }) {
  const url = `${SITE_URL}/${p.url_key}.html`;
  const min = p.price_range.minimum_price.final_price;
  const max = p.price_range.maximum_price.final_price;
  const currency = min.currency ?? 'USD';
  const availability = p.stock_status === 'IN_STOCK' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
  const text = (p.short_description?.html || p.meta_description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const images = (p.media_gallery ?? []).filter((g) => !g.disabled).map((g) => mediaSrc(g.url)).filter((u): u is string => !!u);
  const product = {
    '@type': 'Product',
    name: p.name,
    sku: p.sku,
    url,
    ...(text ? { description: text } : {}),
    ...(images.length ? { image: images } : {}),
    brand: { '@type': 'Brand', name: 'Third Shot Supply Co.' },
    offers:
      max.value > min.value + 0.001
        ? { '@type': 'AggregateOffer', lowPrice: min.value.toFixed(2), highPrice: max.value.toFixed(2), priceCurrency: currency, availability, url }
        : { '@type': 'Offer', price: min.value.toFixed(2), priceCurrency: currency, availability, url, itemCondition: 'https://schema.org/NewCondition' },
    ...(p.review_count > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: (p.rating_summary / 20).toFixed(1), bestRating: '5', reviewCount: p.review_count } }
      : {}),
  };
  const crumbs = [{ name: 'Home', item: `${SITE_URL}/` }, ...(category ? [{ name: category.name, item: `${SITE_URL}${category.href}` }] : []), { name: p.name, item: url }];
  const data = {
    '@context': 'https://schema.org',
    '@graph': [product, { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, ...c })) }],
  };
  // "<" escaped so product copy can never close the script element
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
