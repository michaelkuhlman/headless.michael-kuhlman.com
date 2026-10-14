import Image from 'next/image';
import { Breadcrumbs } from '../Breadcrumbs';
import { Listing } from '../catalog/Listing';
import { getAttributeLabels, listProducts } from '@/lib/magento/catalog';
import type { Category, ProductListResult } from '@/lib/magento/types';

export function swatchMap(res: ProductListResult): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of res.items) for (const o of p.configurable_options ?? []) for (const v of o.values) if (v.swatch_data?.__typename === 'ColorSwatchData') m[v.label] = v.swatch_data.value;
  return m;
}

export async function CategoryPage({ cat }: { cat: Category }) {
  const [res, labels] = await Promise.all([listProducts({ categoryUid: cat.uid, pageSize: 60 }), getAttributeLabels()]);
  return (
    <div className="ts-container" style={{ paddingBottom: 20 }}>
      <Breadcrumbs items={[{ label: cat.name }]} />
      <section className="ts-cat-hero">
        <div className="ts-cat-hero__copy">
          <h1>{cat.name}</h1>
          {cat.description && <div className="ts-cat-hero__desc" dangerouslySetInnerHTML={{ __html: cat.description }} />}
        </div>
        {cat.image && (
          <figure className="ts-cat-hero__media">
            <Image src={cat.image} alt="" fill priority sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 760px" quality={75} />
          </figure>
        )}
      </section>
      <Listing initial={res} categoryUid={cat.uid} swatches={swatchMap(res)} labels={labels} />
    </div>
  );
}
