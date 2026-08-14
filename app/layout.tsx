import type { Metadata } from 'next';

import { fontVariables } from '@/theme/fonts';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cinemadraft',
  description: 'Fantasy movie award leagues',
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
