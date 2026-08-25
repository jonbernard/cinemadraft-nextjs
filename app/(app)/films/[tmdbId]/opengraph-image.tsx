import { ImageResponse } from 'next/og';

import { OgMark } from '@/components/OgMark';
import { CARD, CARD_SIZE } from '@/lib/og';
import { loadFilmPage } from '@/lib/services/film';

/**
 * A film's share card (P15.T6): poster left, title and year right.
 *
 * This is the app's most-pasted URL, so it is the card that matters most. The
 * poster is fetched by Satori at render time from TMDB's CDN; when there is no
 * poster the layout falls back to the mark, rather than leaving a hole.
 *
 * Colours are literals for the reason `app/opengraph-image.tsx` explains:
 * Satori has no CSS variables.
 */
export const alt = 'A film on Cinemadraft';
export const size = CARD_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ tmdbId: string }> }) {
  const { tmdbId } = await params;
  const film = /^\d+$/.test(tmdbId) ? await loadFilmPage(tmdbId) : null;
  const poster = film?.posterUrls[0] ?? null;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 56,
        background: CARD.bg,
        padding: 72,
        fontFamily: 'sans-serif',
      }}
    >
      {poster ? (
        <img
          src={poster}
          alt=""
          width={340}
          height={510}
          style={{ borderRadius: 12, objectFit: 'cover' }}
        />
      ) : (
        <div
          style={{
            width: 340,
            height: 510,
            borderRadius: 12,
            background: CARD.surface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <OgMark size={140} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 620 }}>
        <span
          style={{
            color: CARD.ink,
            fontSize: 66,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          {film?.title ?? 'Not here'}
        </span>
        {film?.year ? (
          <span style={{ color: CARD.inkSecondary, fontSize: 36 }}>{film.year}</span>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
          <OgMark size={44} />
          <span style={{ color: CARD.inkDim, fontSize: 30, letterSpacing: '-0.02em' }}>
            Cinemadraft
          </span>
        </div>
      </div>
    </div>,
    CARD_SIZE,
  );
}
