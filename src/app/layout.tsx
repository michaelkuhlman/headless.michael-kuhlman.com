import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Suspense } from 'react';
import '@/styles/base.css';
import '@/styles/header.css';
import '@/styles/footer.css';
import '@/styles/home.css';
import '@/styles/catalog.css';
import '@/styles/product.css';
import '@/styles/cms.css';
import '@/styles/checkout.css';
import '@/styles/account.css';
import '@/styles/bag.css';
import { DemoNotice } from '@/components/DemoNotice';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Bootstrap } from '@/components/Bootstrap';
import { BagDrawer } from '@/components/BagDrawer';
import { QuickView } from '@/components/QuickView';
import { Toast } from '@/components/Toast';
import { SITE_URL } from '@/lib/site';

const fraunces = localFont({
  src: '../styles/fraunces-latin.woff2',
  variable: '--font-fraunces',
  weight: '300 700',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});
const inter = localFont({
  src: '../styles/inter-latin.woff2',
  variable: '--font-inter',
  weight: '300 800',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Third Shot Supply Co. | Gear for the patient player', template: '%s | Third Shot Supply Co.' },
  description: 'Premium pickleball paddles, tour-grade balls, bags and court gear. A headless Magento demo store built with Next.js.',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
  openGraph: { siteName: 'Third Shot Supply Co. (headless demo)', type: 'website' },
  robots: { index: false, follow: true },
};

export const viewport: Viewport = { themeColor: '#173a2e', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <a className="ts-skip" href="#main">Skip to content</a>
        <DemoNotice />
        <Header />
        <main id="main" className="ts-main">{children}</main>
        <Footer />
        <Suspense fallback={null}>
          <BagDrawer />
        </Suspense>
        <QuickView />
        <Toast />
        <Bootstrap />
      </body>
    </html>
  );
}
