import { ImageResponse } from 'next/og';

import { OgMark } from '@/components/OgMark';
import { CARD, CARD_SIZE } from '@/lib/og';

/**
 * The sitewide share card (P15.T6).
 *
 * Every route without a card of its own inherits this one — what a link to
 * `/`, `/browse` or `/award-shows` renders as when it is pasted into a chat.
 * Colours come from `lib/og.ts`, which reads them out of the token module;
 * Satori cannot resolve a CSS variable.
 */
export const alt = 'Cinemadraft — fantasy movie award leagues';
export const size = CARD_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 28,
        background: CARD.bg,
        padding: 88,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <OgMark size={96} />
        <span style={{ color: CARD.ink, fontSize: 84, letterSpacing: '-0.035em' }}>
          Cinemadraft
        </span>
      </div>
      <span
        style={{
          color: CARD.inkSecondary,
          fontSize: 34,
          lineHeight: 1.35,
          maxWidth: 880,
        }}
      >
        Draft a team of films before awards season and score points as they pick up
        nominations and wins.
      </span>
    </div>,
    CARD_SIZE,
  );
}
