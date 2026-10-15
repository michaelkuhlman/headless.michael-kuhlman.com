import type { MetadataRoute } from 'next';

/**
 * Crawling is allowed so crawlers can read the pages' noindex (a portfolio demo must not compete with real stores in
 * search results); the API and the shopper's own pages are off limits. No sitemap on purpose: nothing is indexed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/checkout', '/customer/', '/sales/', '/saved'] },
  };
}
