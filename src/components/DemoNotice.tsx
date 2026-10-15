import { CLASSIC_URL } from '@/lib/site';

/** Same bar as the classic store, with the headless wording and a link to compare against the Luma build. */
export function DemoNotice() {
  return (
    <aside className="ts-demo-notice" aria-label="Demo store notice">
      <div className="ts-demo-notice__inner">
        <span className="ts-demo-notice__badge">Headless demo</span>
        <span>
          No real orders<span className="ts-demo-notice__long">, payments or shipping</span>.
          <span className="ts-demo-notice__more"> Next.js storefront on Magento GraphQL by Michael Kuhlman.</span>{' '}
          <a href={CLASSIC_URL + '/'}>
            <span className="ts-demo-notice__long">Compare the classic store</span>
            <span className="ts-demo-notice__short">Classic store</span>
          </a>
        </span>
      </div>
    </aside>
  );
}
