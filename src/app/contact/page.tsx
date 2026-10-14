import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ContactForm } from '@/components/pages/MiscViews';

export const metadata: Metadata = {
  title: 'Contact us',
  description: 'Questions about a paddle, an order or a team discount? We answer every message within one business day.',
  alternates: { canonical: '/contact/' },
};
export default function Page() {
  return (
    <div className="ts-container">
      <Breadcrumbs items={[{ label: 'Contact' }]} />
      <div className="ts-contact-page">
        <div className="ts-contact">
          <p className="ts-eyebrow">Contact</p>
          <h1>Talk to a player.</h1>
          <p className="ts-lede">Questions about a paddle, an order or a team discount? We answer every message within one business day.</p>
          <ul className="ts-contact__list">
            <li>
              <strong>Email</strong>
              <span>hello@thirdshot.example</span>
            </li>
            <li>
              <strong>Hours</strong>
              <span>Mon to Fri, 8 am to 5 pm Pacific</span>
            </li>
            <li>
              <strong>Workshop</strong>
              <span>By appointment for paddle fittings</span>
            </li>
          </ul>
          <p className="ts-contact__note">Demo store: this form validates, but no message is sent.</p>
        </div>
        <ContactForm />
      </div>
    </div>
  );
}
