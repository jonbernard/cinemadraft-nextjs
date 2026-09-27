import type { NextRequest } from 'next/server';

import { eventRepository } from '@/lib/repositories/events';
import { buildCalendarFeed } from '@/lib/services/ical';

/**
 * The ceremony-dates calendar feed (T25) — one of D8's three permitted
 * `/api` routes, alongside the Clerk webhook and the live stream.
 *
 * 🔴 **Public, with no session, by the owner's ruling (D127).** The audience is
 * a calendar client — Google, Apple, Outlook — polling a URL somebody pasted
 * into it, and none of them sends a Clerk session. Until D127 this route called
 * `requirePageUser()`, reproducing what the proxy's default had always
 * answered, so every subscriber got a 307 to the login page and the feed never
 * worked for the only audience it has.
 *
 * Open is safe because of what the route can reach, not because of what it
 * happens to print today: it reads exactly one repository, `eventRepository`,
 * whose rows carry no user, league or member column at all, and the feed says
 * only what the public `/award-shows` pages (D44) already say — a show's name,
 * its two dates, and a link to its page. `route.test.ts` pins the output side
 * of that: joinable secret rows exist and none reaches the body.
 *
 * `[[...slug]]`, optional: `/api/ical` serves every show, which is the URL
 * `/award-shows` hands out and what the source's `GET /events/calendar.ics`
 * served. It was a required catch-all until D127, which never matches zero
 * segments, so that link 404'd. Next passes `slug: undefined` for the bare
 * path. A single segment scopes the feed to one show's abbreviation; anything
 * else (more than one segment, or an abbreviation that does not exist) is a
 * 404, same as any other bad slug in this app.
 *
 * `baseUrl` is the request's own origin. On Vercel that is the host the
 * subscriber asked for (the platform sets it from `Host`/`x-forwarded-host`),
 * so a feed subscribed at the production domain links back to it and a
 * preview's links stay on the preview.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug = [] } = await params;

  if (slug.length > 1) {
    return new Response('not found', { status: 404 });
  }

  const shows =
    slug.length === 0
      ? await eventRepository.findAll()
      : await (async () => {
          const show = await eventRepository.findByAbbreviation(slug[0]);
          return show ? [show] : null;
        })();

  if (shows === null) {
    return new Response('not found', { status: 404 });
  }

  const baseUrl = new URL(request.url).origin;
  const body = buildCalendarFeed(shows, { baseUrl });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // `inline` so a browser that opens the link shows or hands it to the
      // calendar app rather than forcing a save; the filename is what a save
      // gets called if it does happen.
      'Content-Disposition': `inline; filename="cinemadraft-${slug[0] ?? 'award-shows'}.ics"`,
      // Identical for every reader now that there is no session, so shared
      // caches may keep it. An hour is shorter than any calendar client's own
      // poll interval, and keeps a corrected date from sitting stale for long —
      // `/api/revalidate` cannot purge this, so no `s-maxage` beyond it.
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
