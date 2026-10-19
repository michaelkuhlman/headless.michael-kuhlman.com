'use client';

// The quick view's product half (gallery + buy box). Loaded on demand by QuickView so these product-page
// components stay out of the JavaScript every page needs on first load.
import { Gallery, galleryImages } from './Gallery';
import { BuyBox } from './BuyBox';
import type { Product } from '@/lib/magento/types';

export default function QuickViewBody({ p, onAdded }: { p: Product; onAdded: () => void }) {
  return (
    <div className="ts-qv">
      <Gallery images={galleryImages(p.media_gallery, p.name)} name={p.name} compact />
      <BuyBox p={p} compact headingLevel={2} onAdded={onAdded} />
    </div>
  );
}
