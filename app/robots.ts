import type { MetadataRoute } from 'next';

import { canonical } from '@/lib/seo';

/**
 * Crawl rules (P15.T6).
 *
 * 🔴 Not a security boundary — `proxy.ts` is (D44). Everything disallowed here
 * either answers a redirect to sign-in or is a page nobody benefits from
 * finding in a search result; the point is crawl budget and tidy results, not
 * access control. A crawler that ignores this file learns nothing it could not
 * learn by requesting the URL directly, and the proxy answers that request.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/leagues',
        '/list',
        '/watchlist',
        '/members',
        '/auth',
        '/join',
      ],
    },
    sitemap: canonical('/sitemap.xml'),
  };
}
