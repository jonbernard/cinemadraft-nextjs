import type { MetadataRoute } from 'next';

import { eventRepository } from '@/lib/repositories/events';
import { movieRepository } from '@/lib/repositories/movies';
import { canonical } from '@/lib/seo';

/**
 * How many film pages the sitemap will publish.
 *
 * The catalogue is every film the app has ever ingested, which grows with every
 * draft and every browse. The cap keeps one file under the 50,000-URL limit and
 * well under 50MB without needing a sitemap index; if it is ever reached, the
 * fix is an index of paged sitemaps, not a bigger number here.
 */
const FILM_LIMIT = 5000;

/**
 * The public URL list (P15.T6).
 *
 * 🔴 **Only routes that are public by D44 may appear**, and `proxy.ts`'s
 * `isPublic` list is the source of truth for that. A private URL published here
 * is not merely useless — it advertises the existence of pages that answer a
 * redirect, and for `/members/[uuid]` it would publish the uuid itself.
 *
 * Films are the app's own rows, not every TMDB id: a sitemap of ids the app has
 * never ingested is an invented catalogue, and every one of those pages would
 * be built on demand for a crawler that asked.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [events, films] = await Promise.all([
    eventRepository.findAll(),
    movieRepository.listForSitemap(FILM_LIMIT),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: canonical('/'), changeFrequency: 'daily', priority: 1 },
    { url: canonical('/browse'), changeFrequency: 'daily', priority: 0.8 },
    { url: canonical('/award-shows'), changeFrequency: 'weekly', priority: 0.7 },
    { url: canonical('/rules-and-scoring'), changeFrequency: 'yearly', priority: 0.3 },
  ];

  const showPages: MetadataRoute.Sitemap = events
    .filter((event) => event.abbreviation != null)
    .map((event) => ({
      url: canonical(`/award-shows/${event.abbreviation}`),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

  const filmPages: MetadataRoute.Sitemap = films.map((film) => ({
    url: canonical(`/films/${film.tmdbId}`),
    lastModified: film.updatedAt ?? undefined,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  return [...staticPages, ...showPages, ...filmPages];
}
