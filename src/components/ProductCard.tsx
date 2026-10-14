import Link from 'next/link';
import Image from 'next/image';
import type { ProductCard as Card } from '@/lib/magento/types';
import { mediaSrc, money, priceInfo } from '@/lib/format';
import { CardTools, CardAdd } from './CardActions';

export const CARD_SIZES = '(max-width: 767px) 46vw, (max-width: 1023px) 31vw, (max-width: 1320px) 24vw, 320px';

export function Price({ pr, className = '' }: { pr: Card['price_range']; className?: string }) {
  const p = priceInfo(pr);
  if (p.isRange && !p.onSale) {
    return (
      <span className={className}>
        <span className="ts-price">{money(p.final)}</span> <span className="ts-dash">&ndash;</span> <span className="ts-price">{money(p.max)}</span>
      </span>
    );
  }
  return (
    <span className={className}>
      <span className={`ts-price${p.onSale ? ' ts-price--special' : ''}`}>{money(p.final)}</span>
      {p.onSale && (
        <>
          {' '}
          <span className="ts-price ts-price--old">
            <span className="sr-only">Regular price </span>
            {money(p.regular)}
          </span>
        </>
      )}
    </span>
  );
}

export function Stars({ pct, label }: { pct: number; label?: string }) {
  return (
    <span className="ts-rating__stars" role="img" aria-label={label ?? `Rated ${Math.round((pct / 20) * 10) / 10} out of 5`}>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

export function ProductCard({ p, priority = false, sizes = CARD_SIZES }: { p: Card; priority?: boolean; sizes?: string }) {
  const href = `/${p.url_key}.html`;
  const src = mediaSrc(p.small_image?.url);
  const swatchOpt = p.configurable_options?.find((o) => o.values.some((v) => v.swatch_data));
  const oos = p.stock_status === 'OUT_OF_STOCK';
  return (
    <div className="ts-card">
      <div className="ts-card__top">
        <Link href={href} className="ts-card__media" tabIndex={-1} aria-hidden="true" prefetch>
          {src ? <Image src={src} alt="" fill sizes={sizes} priority={priority} quality={75} /> : <span className="ts-card__ph">No photo</span>}
        </Link>
        <CardTools urlKey={p.url_key} name={p.name} />
        {!oos && <CardAdd p={p} />}
      </div>
      <h3 className="ts-card__name">
        <Link href={href} prefetch>{p.name}</Link>
      </h3>
      <p className="ts-card__price">
        <Price pr={p.price_range} />
      </p>
      {p.review_count > 0 && (
        <div className="ts-card__rating ts-rating">
          <Stars pct={p.rating_summary} />
          <span>
            {p.review_count} {p.review_count === 1 ? 'Review' : 'Reviews'}
          </span>
        </div>
      )}
      {swatchOpt && (
        <div className="ts-card__swatches" aria-label={`${swatchOpt.label}: ${swatchOpt.values.map((v) => v.label).join(', ')}`}>
          {swatchOpt.values.map((v) =>
            v.swatch_data?.__typename === 'ColorSwatchData' ? (
              <span key={v.uid} title={v.label} style={{ background: v.swatch_data.value }} />
            ) : (
              <span key={v.uid} className="is-text" title={v.label}>
                {v.swatch_data?.value ?? v.label}
              </span>
            ),
          )}
        </div>
      )}
      {oos && <span className="ts-card__oos">Out of stock</span>}
    </div>
  );
}

export function ProductGrid({ items, cols = 3, home = false, priorityCount = 0 }: { items: Card[]; cols?: 3 | 4; home?: boolean; priorityCount?: number }) {
  const sizes = cols === 4 ? '(max-width: 767px) 46vw, (max-width: 1023px) 24vw, 310px' : CARD_SIZES.replace('24vw, 320px', '24vw, 410px');
  return (
    <ul className={`ts-grid${cols === 4 ? ' ts-grid--4' : ''}${home ? ' ts-grid--home' : ''}`}>
      {items.map((p, i) => (
        <li key={p.uid}>
          <ProductCard p={p} priority={i < priorityCount} sizes={sizes} />
        </li>
      ))}
    </ul>
  );
}
