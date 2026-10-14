import type { PriceRange } from './magento/types';

export const money = (v: number | null | undefined) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v ?? 0));

/** Magento media URLs: drop the resize cache segment so next/image works from the original file. */
export function mediaSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes('/placeholder/')) return null;
  return url.replace(/\/media\/catalog\/product\/cache\/[0-9a-f]+\//, '/media/catalog/product/');
}

export function priceInfo(pr: PriceRange) {
  const min = pr.minimum_price;
  const max = pr.maximum_price;
  const final = min.final_price.value;
  const regular = min.regular_price.value;
  const onSale = final < regular - 0.001;
  const isRange = max.final_price.value > final + 0.001;
  return { final, regular, onSale, isRange, max: max.final_price.value };
}

/** Store-relative path for a Magento absolute URL (CMS content links). */
export function storePath(href: string, origin: string): string | null {
  if (href.startsWith(origin)) {
    const p = href.slice(origin.length) || '/';
    return p.startsWith('/') ? p : `/${p}`;
  }
  return null;
}

export function stripTags(html: string | null | undefined): string {
  return (html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

export const productPath = (urlKey: string) => `/${urlKey}.html`;
export const categoryPath = (urlPath: string) => `/${urlPath}.html`;
