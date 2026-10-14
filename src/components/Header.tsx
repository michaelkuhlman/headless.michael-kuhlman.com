import Link from 'next/link';
import { getCategories } from '@/lib/magento/catalog';
import { NavLinks, DrawerToggle, SearchBox, AccountLink, SavedLink, BagButton, ScrollHeader } from './HeaderClient';

export async function Header() {
  const cats = (await getCategories()).map((c) => ({ name: c.name, href: `/${c.url_path}.html` }));
  return (
    <header className="ts-header">
      <ScrollHeader />
      <div className="ts-container ts-header__inner">
        <DrawerToggle cats={cats} />
        <Link className="ts-logo" href="/" aria-label="Third Shot Supply Co. home" prefetch>
          <img src="/logo.svg" alt="Third Shot Supply Co." width={291} height={76} />
        </Link>
        <nav className="ts-nav" aria-label="Shop categories">
          <NavLinks cats={cats} />
        </nav>
        <SearchBox />
        <AccountLink />
        <SavedLink />
        <BagButton />
      </div>
    </header>
  );
}
