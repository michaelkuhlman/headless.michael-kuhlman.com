import { CLASSIC_URL } from '@/lib/site';

/** Same bar as the classic store, with the headless wording and a link to compare against the Luma build. */
export function DemoNotice() {
  return (
    <div className="ts-demo-notice" role="note">
      <div className="ts-demo-notice__inner">
        <span className="ts-demo-notice__badge">Headless demo</span>
        <span>
          No real orders, payments or shipping.<span className="ts-demo-notice__more"> Next.js storefront on Magento GraphQL by Michael Kuhlman.</span>{' '}
          <a href={CLASSIC_URL + '/'}>Compare the classic store</a>
        </span>
      </div>
    </div>
  );
}
