import type { Metadata } from 'next';

import { canonical, SITE_URL, TITLE_TEMPLATE } from '@/lib/seo';
import { fontVariables } from '@/theme/fonts';
import { Providers } from './providers';
import './globals.css';

/**
 * The metadata every page inherits (P15.T6).
 *
 * `metadataBase` is what lets a route return a relative OG image path and get
 * an absolute URL in the markup — without it Next warns and emits the path
 * unresolved, which no scraper follows. `title.template` means a route sets
 * only its own name; the suffix is applied here so it cannot drift page to
 * page.
 */
export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: 'Cinemadraft', template: TITLE_TEMPLATE },
  description:
    'Draft a team of films before awards season and score points as they pick up nominations and wins.',
  alternates: { canonical: canonical('/') },
  openGraph: {
    siteName: 'Cinemadraft',
    type: 'website',
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image' },
};

/**
 * `suppressHydrationWarning` is required, not cosmetic: `InitColorSchemeScript`
 * (see providers.tsx) stamps data-mui-color-scheme onto <html> before React
 * hydrates, so the server markup and the first client render legitimately
 * differ on this one element.
 */
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
