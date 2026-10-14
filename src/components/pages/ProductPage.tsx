import { cacheLife, cacheTag } from 'next/cache';
import { Breadcrumbs } from '../Breadcrumbs';
import { ProductCard } from '../ProductCard';
import { ProductView } from '../product/ProductView';
import { Tabs, type TabDef } from '../product/Tabs';
import { ReviewForm, type RatingMeta } from '../product/ReviewForm';
import { RecentStrip } from '../product/RecentStrip';
import { Stars } from '../ProductCard';
import { CmsContent } from '../CmsContent';
import { getAttributeLabels, getCategories, getCmsBlocks } from '@/lib/magento/catalog';
import { magento } from '@/lib/magento/client';
import type { Product, ProductCard as Card } from '@/lib/magento/types';

async function getRatings(): Promise<RatingMeta[]> {
  'use cache';
  cacheLife('days');
  cacheTag('catalog', 'ratings');
  const d = await magento<{ productReviewRatingsMetadata: { items: RatingMeta[] } }>(`{ productReviewRatingsMetadata { items { id name values { value_id value } } } }`);
  return d.productReviewRatingsMetadata.items;
}

function Strip({ title, items }: { title: string; items: Card[] }) {
  if (!items.length) return null;
  return (
    <section className="ts-strip">
      <div className="ts-strip__head">
        <h2>{title}</h2>
      </div>
      <ul className={`ts-strip__row${items.length < 4 ? ' ts-strip__row--few' : ''}`}>
        {items.map((p) => (
          <li key={p.uid}>
            <ProductCard p={p} sizes="(max-width: 767px) 44vw, (max-width: 1023px) 31vw, 410px" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function fmtDate(s: string) {
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export async function ProductPage({ p }: { p: Product }) {
  const [labels, blocks, ratings, cats] = await Promise.all([getAttributeLabels(), getCmsBlocks(['ts-pdp-usps']), getRatings(), getCategories()]);
  const top = cats.find((c) => p.categories.some((pc) => pc.uid === c.uid));
  const attrs = (p.custom_attributesV2?.items ?? [])
    .map((a) => ({ label: labels[a.code] ?? a.code, value: a.selected_options?.map((o) => o.label).join(', ') || a.value || '' }))
    .filter((a) => a.value && !/<[a-z]/i.test(a.value));

  const tabs: TabDef[] = [
    {
      id: 'details',
      label: 'Details',
      content: p.description?.html ? <div className="ts-desc" dangerouslySetInnerHTML={{ __html: p.description.html }} /> : <p>No details yet.</p>,
    },
  ];
  if (attrs.length)
    tabs.push({
      id: 'additional',
      label: 'More Information',
      content: (
        <table className="ts-attrs">
          <tbody>
            <tr>
              <th scope="row">SKU</th>
              <td>{p.sku}</td>
            </tr>
            {attrs.map((a) => (
              <tr key={a.label}>
                <th scope="row">{a.label}</th>
                <td>{a.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
    });
  tabs.push({
    id: 'reviews',
    label: 'Reviews',
    count: p.review_count,
    content: (
      <div className="ts-reviews">
        {p.reviews.items.length > 0 && <h3>Customer Reviews</h3>}
        {p.reviews.items.map((r, i) => (
          <article className="ts-review" key={i}>
            <p className="ts-review__title">{r.summary}</p>
            <div className="ts-review__stars ts-rating">
              <Stars pct={r.average_rating} />
            </div>
            <p className="ts-review__text">{r.text}</p>
            <p className="ts-review__by">
              Review by <strong>{r.nickname}</strong> &middot; Posted on {fmtDate(r.created_at)}
            </p>
          </article>
        ))}
        <ReviewForm sku={p.sku} name={p.name} ratings={ratings} />
      </div>
    ),
  });

  const related = [...p.related_products, ...p.upsell_products.filter((u) => !p.related_products.some((r) => r.sku === u.sku))];
  const usps = blocks['ts-pdp-usps'] ? <CmsContent html={blocks['ts-pdp-usps'].content} /> : null;

  return (
    <div className="ts-container">
      <div className="ts-pdp">
        <ProductView
          p={p}
          usps={usps}
          breadcrumbs={<Breadcrumbs items={[...(top ? [{ label: top.name, href: `/${top.url_path}.html` }] : []), { label: p.name }]} />}
        />
        <Tabs tabs={tabs} />
      </div>
      <div className="ts-pdp-after">
        <Strip title="You might also like" items={related.slice(0, 8)} />
        <RecentStrip current={p.url_key} />
      </div>
    </div>
  );
}
