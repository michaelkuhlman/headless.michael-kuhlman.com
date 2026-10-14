'use client';

import { useCallback, useState } from 'react';
import { Gallery, galleryImages } from './Gallery';
import { BuyBox } from './BuyBox';
import type { Product, Variant } from '@/lib/magento/types';

/** Gallery + buy box sharing the chosen variant (its photos replace the parent's). */
export function ProductView({ p, usps, breadcrumbs }: { p: Product; usps?: React.ReactNode; breadcrumbs?: React.ReactNode }) {
  const [variant, setVariant] = useState<Variant | null>(null);
  const onVariant = useCallback((v: Variant | null) => setVariant(v), []);
  const vImgs = variant ? galleryImages(variant.product.media_gallery, p.name) : [];
  const images = vImgs.length ? vImgs : galleryImages(p.media_gallery, p.name);
  return (
    <>
      <div style={{ gridColumn: '1 / -1' }}>{breadcrumbs}</div>
      <Gallery images={images} name={p.name} />
      <BuyBox p={p} onVariant={onVariant} usps={usps} />
    </>
  );
}
