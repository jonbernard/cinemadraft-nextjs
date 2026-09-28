import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FILM_PAGE_ROUTE,
  filmHref,
  filmSlugPart,
  foldAccents,
  parseFilmSegment,
} from './film-href';

describe('film URLs (D133)', () => {
  it('spells every film title-then-id, held or not', () => {
    expect(filmHref({ tmdbId: '1204680', title: 'Coyote vs. Acme' })).toBe(
      '/films/coyote-vs-acme-1204680',
    );
    expect(filmHref({ tmdbId: 329865, title: 'Arrival' })).toBe('/films/arrival-329865');
  });

  it('folds accents, ampersands and apostrophes', () => {
    expect(filmSlugPart('Nǎi Nai & Wài Pó')).toBe('nai-nai-and-wai-po');
    expect(filmSlugPart('I’m Still Here')).toBe('im-still-here');
    expect(filmSlugPart('TÁR')).toBe('tar');
    expect(foldAccents('Amélie')).toBe('Amelie');
  });

  it('keeps the bare id when nothing Latin survives', () => {
    expect(filmHref({ tmdbId: '1158915', title: '弟弟' })).toBe('/films/1158915');
  });

  it('cuts a long title at a word break, within 80 characters', () => {
    const slug = filmSlugPart(`${'word '.repeat(30)}end`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('word')).toBe(true);
    // And what it spells, it can read back.
    expect(parseFilmSegment(`${slug}-42`)).toEqual({ tmdbId: '42', slugPart: slug });
  });

  it('reads the id from the end, even when the title is digits', () => {
    expect(parseFilmSegment('1917-530915')).toEqual({
      tmdbId: '530915',
      slugPart: '1917',
    });
    expect(parseFilmSegment('530915')).toEqual({ tmdbId: '530915', slugPart: '' });
    expect(parseFilmSegment('smile-2-1100782')).toEqual({
      tmdbId: '1100782',
      slugPart: 'smile-2',
    });
  });

  it('refuses anything that is not a slug and an id, before any request', () => {
    for (const bad of [
      'arrival',
      '../..',
      '%00',
      'Arrival-329865',
      `${'a'.repeat(200)}-1`,
      '1234567890123',
      '-329865',
    ])
      expect(parseFilmSegment(bad)).toBeNull();
  });

  it('never links to /films/null', () => {
    expect(filmHref({ tmdbId: '313369', title: null })).toBe('/films/313369');
  });

  it('names the page file that revalidation has to match, route group included', () => {
    expect(existsSync(join(process.cwd(), 'app', FILM_PAGE_ROUTE, 'page.tsx'))).toBe(
      true,
    );
    expect(FILM_PAGE_ROUTE.startsWith('/(')).toBe(true);
  });
});
