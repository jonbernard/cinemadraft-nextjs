'use client';

import { useEffect } from 'react';

/**
 * The last resort: an error in the root layout itself.
 *
 * 🔴 This replaces `<html>` and `<body>`, so it cannot use the app's providers,
 * fonts or theme — they are exactly what may have failed. It is deliberately
 * plain and self-contained, with inline styles rather than token classes,
 * because reaching for the design system here is what would make it fail too.
 *
 * The tokens are still named in the styles so it reads as the same app, but
 * they carry literal fallbacks: if `globals.css` never loaded, a bare
 * `var(--color-bg-base)` would resolve to nothing and leave black text on a
 * transparent ground.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error('[global error]', { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--color-bg-base, #0b0d10)',
          color: 'var(--color-text-primary, #e8e6e1)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <main style={{ maxWidth: '32rem', padding: '1.5rem' }}>
          <h1
            style={{
              fontSize: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Cinemadraft is down
          </h1>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6, opacity: 0.8 }}>
            Something failed before the page could load. It has been logged. Reloading may
            be enough; if not, it is not you.
          </p>
          <a
            href="/"
            style={{ fontSize: '0.875rem', color: 'var(--color-accent-text, #da707c)' }}
          >
            Reload the dashboard
          </a>
        </main>
      </body>
    </html>
  );
}
