import type { Metadata } from 'next';
import { CheckoutView } from '@/components/checkout/CheckoutView';
import { getRegions } from '@/lib/magento/catalog';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const regions = await getRegions();
  return <CheckoutView regions={regions} />;
}
