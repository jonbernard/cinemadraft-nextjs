import { Inter } from 'next/font/google';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

import type { Metadata } from 'next';

import Layout from './_components/layout';
import Providers from './_components/providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Cinemadraft | Get your cinema draft on!',
    template: '%s | Cinemadraft',
  },
  description:
    'Get your cinema draft on! Collect your friends, pick you movie roster, and wait for Award Season to unfold so you can flaunt your cinematic knowledge.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${inter.className} antialiased`}>
        <AppRouterCacheProvider>
          <Providers>
            <Layout>{children}</Layout>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
