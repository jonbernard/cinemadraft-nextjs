import type { NextRequest } from 'next/server';

import { eventRepository } from '@/lib/repositories/events';
import { buildCalendarFeed } from '@/lib/services/ical';

/**
 * The ceremony-dates calendar feed (T25) — one of D8's three permitted
 * `/api` routes, alongside the Clerk webhook and the live stream.
 *
 * 🔴 Public, with no session. It must only ever say what the public
 * award-show pages already say: show names and dates. This route reads
 * exactly one repository (`eventRepository`), which carries no user, league
 * or member column at all — there is nothing here to accidentally join in.
 *
 * `[...slug]`: the source route (`GET /events/calendar.ics`) took no
 * parameters and served every show in one feed. That is still the honest
 * default here — no slug — but a single-segment slug additionally scopes the
 * feed to one show's abbreviation, which is what makes "subscribe to this
 * show's dates" a link a person can actually use from its own page. Anything
 * else (more than one segment, or an abbreviation that does not exist) is a
 * 404, same as any other bad slug in this app.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;

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
      'Content-Disposition': 'inline',
    },
  });
}
