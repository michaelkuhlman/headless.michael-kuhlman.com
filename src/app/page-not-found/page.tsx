import NotFound from '../not-found';

/** Static 404 body: proxy.ts rewrites unknown store URLs here with a real 404 status. */
export const metadata = { title: 'Page not found', robots: { index: false, follow: true } };
export default NotFound;
