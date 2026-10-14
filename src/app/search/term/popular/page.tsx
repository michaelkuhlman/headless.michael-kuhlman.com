import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export const metadata: Metadata = { title: 'Popular searches', alternates: { canonical: '/search/term/popular/' } };
const TERMS = ['ball', 'cap', 'paddle', 'paddles', 'tape'];
export default function Page() {
  return (
    <div className="ts-container" style={{ paddingBottom: 40 }}>
      <Breadcrumbs items={[{ label: 'Popular searches' }]} />
      <div className="ts-page--aside">
        <div className="ts-page__main">
          <h1 className="ts-terms-title">Popular searches</h1>
          <ul className="ts-terms">
            {TERMS.map((t) => (
              <li key={t}>
                <Link href={`/catalogsearch/result/?q=${encodeURIComponent(t)}`}>{t}</Link>
              </li>
            ))}
          </ul>
        </div>
        <aside className="ts-page__aside">
          <div className="ts-help-card">
            <span className="ts-eyebrow">Need a hand?</span>
            <h2>Talk to a player.</h2>
            <p>Questions about a paddle, an order or a team discount? We answer every message within one business day.</p>
            <Link className="ts-btn" href="/contact">
              Contact us
            </Link>
            <ul className="ts-help-card__links">
              <li>
                <Link href="/faq">FAQ</Link>
              </li>
              <li>
                <Link href="/shipping-returns">Shipping &amp; Returns</Link>
              </li>
              <li>
                <Link href="/sales/guest/form/">Order status</Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
