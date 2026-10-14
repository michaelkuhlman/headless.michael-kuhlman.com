import type { Metadata } from 'next';
import { AddressBook } from '@/components/account/AccountEdit';
import { getRegions } from '@/lib/magento/catalog';

export const metadata: Metadata = { title: 'Address Book', robots: { index: false, follow: false } };
export default async function Page() {
  const regions = await getRegions();
  return (
    <div className="ts-container">
      <AddressBook regions={regions} />
    </div>
  );
}
