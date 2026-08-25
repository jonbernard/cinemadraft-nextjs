import { ImageResponse } from 'next/og';

import { OgMark } from '@/components/OgMark';
import { CARD, CARD_SIZE } from '@/lib/og';
import { getAwardShow } from '@/lib/services/award-show';
import { getActiveYear } from '@/lib/services/season';

/**
 * An award show's share card (P15.T6): the show's mark, its name, the season.
 *
 * The logo is the Blob URL Phase 11 ingested, fetched by Satori at render time.
 * A show with no logo drops to the app's own mark rather than an empty band.
 */
export const alt = 'An award show on Cinemadraft';
export const size = CARD_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ abbr: string }> }) {
  const { abbr } = await params;

  let name = abbr.toUpperCase();
  let logo: string | null = null;
  let season: number | null = null;
  try {
    season = await getActiveYear();
    const show = await getAwardShow(abbr, season);
    name = show.name;
    logo = show.imageUrl;
  } catch {
    // A show that does not exist still gets a card: the page it belongs to
    // answers 404, and a broken image in a chat window is worse than a plain one.
  }

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
      {logo ? (
        <img src={logo} alt="" height={150} style={{ objectFit: 'contain' }} />
      ) : (
        <OgMark size={120} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span
          style={{
            color: CARD.ink,
            fontSize: 72,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          {name}
        </span>
        {season ? (
          <span style={{ color: CARD.brass, fontSize: 38 }}>{season} season</span>
        ) : null}
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
