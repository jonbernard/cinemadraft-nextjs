import { ImageResponse } from 'next/og';

import { OgMark } from '@/components/OgMark';
import { CARD, CARD_SIZE } from '@/lib/og';

/**
 * The share card for the page most likely to be pasted into a group chat
 * (P18.T8).
 *
 * 🔴 **No numbers on it.** A card is a cached PNG: a point value baked into one
 * cannot be re-derived when the `points` table changes and cannot be corrected
 * in the conversation it was pasted into. Every figure on the page itself is
 * live and traceable to the scoring service; the one that would not be is
 * absent rather than stale.
 *
 * Shape and lockup are `app/(app)/award-shows/[abbr]/opengraph-image.tsx`'s —
 * mark, headline, wordmark — so a reader who has seen one card recognises this
 * one. `fontFamily: 'sans-serif'` because Satori cannot reach the app's fonts.
 *
 * 🔴 Synchronous and data-free, deliberately: this route answers on a database
 * that has only been migrated, which is where the rest of the page degrades to
 * its prose. A card that queried would 500 exactly when the link is newest.
 */
export const alt = 'How Cinemadraft works';
export const size = CARD_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: CARD.bg,
        padding: 80,
        fontFamily: 'sans-serif',
      }}
    >
      <OgMark size={120} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span
          style={{
            color: CARD.ink,
            fontSize: 72,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          Draft a team of films.
        </span>
        <span style={{ color: CARD.brass, fontSize: 38 }}>
          Let the awards keep score.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <OgMark size={44} />
        <span style={{ color: CARD.inkDim, fontSize: 30, letterSpacing: '-0.02em' }}>
          Cinemadraft
        </span>
      </div>
    </div>,
    CARD_SIZE,
  );
}
