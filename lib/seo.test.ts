import { describe, expect, it } from 'vitest';

import { canonical, movieJsonLd, SITE_URL } from './seo';

describe('canonical', () => {
  it('resolves a path against the site origin', () => {
    expect(canonical('/films/550')).toBe(`${SITE_URL.origin}/films/550`);
  });

  it('drops query strings, so ?year= and ?page= do not compete with the page', () => {
    expect(canonical('/browse?when=future&page=3')).toBe(`${SITE_URL.origin}/browse`);
  });

  it('never returns a preview origin', () => {
    // VERCEL_URL is per-deployment; a canonical pointing at it would tell a
    // crawler the preview is the real page.
    expect(canonical('/')).not.toContain('vercel.app');
  });
});

describe('movieJsonLd', () => {
  const FULL = {
    tmdbId: '550',
    title: 'Fight Club',
    overview: 'A ticking-time-bomb insomniac.',
    tagline: 'Mischief. Mayhem. Soap.',
    releaseDate: new Date('1999-10-15T00:00:00.000Z'),
    runtimeMinutes: 139,
    language: 'en',
    genres: ['Drama', 'Thriller'],
    posterUrls: ['https://image.tmdb.org/t/p/w500/poster.jpg'],
    crew: [
      {
        department: 'Directing',
        people: [
          { name: 'David Fincher', job: 'Director' },
          { name: 'Someone Else', job: 'Script Supervisor' },
        ],
      },
      { department: 'Writing', people: [{ name: 'Jim Uhls', job: 'Screenplay' }] },
    ],
  };

  it('describes the film as a schema.org Movie', () => {
    expect(movieJsonLd(FULL)).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Movie',
      name: 'Fight Club',
      url: 'https://cinemadraft.com/films/550',
      image: 'https://image.tmdb.org/t/p/w500/poster.jpg',
      description: 'A ticking-time-bomb insomniac.',
      datePublished: '1999-10-15',
      duration: 'PT139M',
      inLanguage: 'en',
      genre: ['Drama', 'Thriller'],
    });
  });

  it('🔴 credits only the director, not everyone in the Directing department', () => {
    // TMDB files script supervisors and assistant directors there too.
    expect(movieJsonLd(FULL).director).toEqual([
      { '@type': 'Person', name: 'David Fincher' },
    ]);
  });

  it('🔴 omits every field it does not have rather than guessing one', () => {
    // Structured data is machine-read, so a wrong field is asserted as
    // confidently as a right one and no reader is there to discount it.
    const bare = movieJsonLd({
      tmdbId: '1',
      title: 'Untitled',
      overview: null,
      tagline: null,
      releaseDate: null,
      runtimeMinutes: null,
      language: null,
      genres: [],
      posterUrls: [],
      crew: [],
    });

    expect(Object.keys(bare).sort()).toEqual(['@context', '@type', 'name', 'url']);
  });

  it('falls back to the tagline only when there is no synopsis', () => {
    const film = movieJsonLd({ ...FULL, overview: null });
    expect(film.description).toBe('Mischief. Mayhem. Soap.');
  });

  it('🔴 dates the release in UTC', () => {
    // A film released on the 1st must not publish on the 31st for a crawler
    // reaching a machine west of UTC — the browse grouping's bug, here too.
    const film = movieJsonLd({
      ...FULL,
      releaseDate: new Date('2026-03-01T00:00:00.000Z'),
    });
    expect(film.datePublished).toBe('2026-03-01');
  });

  it('never claims an aggregateRating', () => {
    // We hold IMDb's score via OMDb, but `aggregateRating` would claim it as
    // this page's own — which is not what the property means.
    expect(movieJsonLd(FULL)).not.toHaveProperty('aggregateRating');
  });
});
