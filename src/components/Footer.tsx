import Link from 'next/link';
import { NewsletterForm } from './NewsletterForm';
import { CLASSIC_URL } from '@/lib/site';

const SHOP = [
  ['Paddles', '/paddles.html'],
  ['Balls', '/balls.html'],
  ['Bags & Covers', '/bags-covers.html'],
  ['Apparel & Headwear', '/apparel-headwear.html'],
  ['Court & Training', '/court-training.html'],
  ['Accessories', '/accessories.html'],
];
const HELP = [
  ['Shipping & Returns', '/shipping-returns'],
  ['FAQ', '/faq'],
  ['Contact', '/contact'],
  ['Order Status', '/sales/guest/form/'],
];
const COMPANY = [
  ['Our Story', '/about'],
  ['My Account', '/customer/account/'],
  ['Privacy', '/privacy-policy-cookie-restriction-mode'],
  ['Popular Searches', '/search/term/popular/'],
];

/** Same content as the classic store's ts-footer-columns block; static, so it costs no Magento call. */
export function Footer() {
  const year = 2026;
  return (
    <footer className="ts-page-footer">
      <div className="ts-container">
        <div className="ts-footer__news">
          <div>
            <span className="ts-eyebrow">The Rally Report</span>
            <h2>Drills, gear drops and court notes. Twice a month, never more.</h2>
          </div>
          <div>
            <NewsletterForm />
            <p className="ts-footer__fine">Demo store: the form works, but no emails are ever sent.</p>
          </div>
        </div>
        <div className="ts-footer__grid">
          <div className="ts-footer__brand">
            <img src="/logo-light.svg" alt="Third Shot Supply Co." width={214} height={56} loading="lazy" />
            <p>Gear for the patient player. Paddles, balls and court kit, tested in real rec and league play before it reaches the shop.</p>
          </div>
          {(
            [
              ['Shop', SHOP],
              ['Help', HELP],
              ['Company', COMPANY],
            ] as const
          ).map(([title, links]) => (
            <nav key={title} className="ts-footer__col" aria-label={title}>
              <h4>{title}</h4>
              <ul>
                {links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} prefetch={false}>{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="ts-footer__col ts-footer__demo">
            <h4>About this demo</h4>
            <p>
              A portfolio build by <a href="https://www.michael-kuhlman.com/">Michael Kuhlman</a>, Magento 2 / Adobe Commerce developer. A headless Next.js
              storefront reading the same Mage-OS 2.4 catalogue over GraphQL as the <a href={CLASSIC_URL + '/'}>classic Luma store</a>.
            </p>
          </div>
        </div>
      </div>
      <div className="ts-copyright">
        <span>&copy; {year} Third Shot Supply Co. A fictional brand.</span>
        <span>Headless storefront: Next.js on Magento Open Source (Mage-OS) GraphQL.</span>
      </div>
    </footer>
  );
}
