import type { Metadata } from 'next';
import { CartView } from '@/components/checkout/CartView';
import { getRegions } from '@/lib/magento/catalog';

export const metadata: Metadata = { title: 'Shopping Bag', robots: { index: false, follow: false } };

export default async function CartPage() {
  const regions = await getRegions();
  return (
    <div className="ts-container">
      <CartView regions={regions} />
    </div>
  );
}
