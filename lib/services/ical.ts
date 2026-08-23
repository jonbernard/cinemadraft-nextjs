/**
 * The calendar feed's body — RFC 5545, hand-rolled.
 *
 * No dependency is added for this (D-brief T25): the source used
 * `ical-generator`, and this repo has no ical package. Adding one means
 * regenerating `package-lock.json`, which is a documented trap on macOS
 * (`npm run lock`, in Docker, is the only safe path). The format this feed
 * needs is a small, well-specified text subset, so it is written out here
 * instead.
 *
 * 🔴 This is a **public URL with no session** (T25). It must only ever
 * describe award shows and their dates — never a person. Every field this
 * module emits comes from `CalendarShow`, which carries no user, league or
 * member data at all; there is no field here to accidentally include.
 */

/** What the feed needs from one award show. All six schedule fields are
 * already-normalized milliseconds (see `eventRepository`'s `Event` type) —
 * this module never touches a bigint. */
export type CalendarShow = {
  id: number;
  abbreviation: string;
  name: string;
  nomDate: number | null;
  nomTime: number | null;
  nomDuration: number | null;
  awardsDate: number | null;
  awardsTime: number | null;
  awardsDuration: number | null;
};

type CalendarEvent = {
  uid: string;
  start: number;
  end: number;
  summary: string;
  url: string;
};

/** No duration recorded: the source's own fallback block length. */
const DEFAULT_DURATION_MS = 30 * 60 * 1000;

/**
 * RFC 5545 §3.3.5 TEXT escaping.
 *
 * Backslash must be escaped first — escaping the others first would
 * double-escape the backslashes those escapes just introduced.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * RFC 5545 §3.1 line folding: no logical line may exceed 75 octets. A folded
 * continuation starts with a single space, which a reader must strip.
 *
 * Byte-aware (`Buffer.byteLength`), not character-aware — a multi-byte UTF-8
 * character split across the 75-octet boundary would corrupt the line if
 * folding only counted characters.
 */
export function foldIcsLine(line: string): string {
  const LIMIT = 75;
  if (Buffer.byteLength(line, 'utf8') <= LIMIT) return line;

  const chunks: string[] = [];
  let rest = line;
  let firstChunk = true;

  while (Buffer.byteLength(rest, 'utf8') > (firstChunk ? LIMIT : LIMIT - 1)) {
    const budget = firstChunk ? LIMIT : LIMIT - 1;
    let take = Math.min(rest.length, budget);
    // Back off until the prefix fits in `budget` octets, so a multi-byte
    // character never gets split in half.
    while (Buffer.byteLength(rest.slice(0, take), 'utf8') > budget) take--;
    chunks.push(rest.slice(0, take));
    rest = rest.slice(take);
    firstChunk = false;
  }
  chunks.push(rest);

  return chunks.join('\r\n ');
}

/** `YYYYMMDDTHHMMSSZ`, UTC basic format (RFC 5545 §3.3.5). */
function formatIcsTimestamp(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

/**
 * The two possible instances for one show — a nominations event and an
 * awards event — each only emitted when its date column is set (fixture
 * adequacy: a show can have either, both, or (silently) neither).
 *
 * `end` falls back to `start + 30 minutes` when no duration is recorded,
 * matching the source's own fallback exactly.
 */
function eventsForShow(show: CalendarShow, baseUrl: string): CalendarEvent[] {
  const url = `${baseUrl}/award-shows/${show.abbreviation}`;
  const events: CalendarEvent[] = [];

  if (show.nomDate != null) {
    const start = show.nomDate + (show.nomTime ?? 0);
    const end = start + (show.nomDuration ?? DEFAULT_DURATION_MS);
    events.push({
      // Derived from the row and which of the two dates this is — never from
      // the current time or a random value. A calendar client keyed on UID
      // would otherwise duplicate every ceremony on each refresh.
      uid: `event-${show.id}-nominations@cinemadraft.app`,
      start,
      end,
      summary: `${show.name} Nominations`,
      url,
    });
  }

  if (show.awardsDate != null) {
    const start = show.awardsDate + (show.awardsTime ?? 0);
    const end = start + (show.awardsDuration ?? DEFAULT_DURATION_MS);
    events.push({
      uid: `event-${show.id}-awards@cinemadraft.app`,
      start,
      end,
      summary: `${show.name} Awards`,
      url,
    });
  }

  return events;
}

function serializeEvent(event: CalendarEvent, dtstamp: string): string {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${formatIcsTimestamp(event.start)}`,
    `DTEND:${formatIcsTimestamp(event.end)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
    `URL:${event.url}`,
    'END:VEVENT',
  ];
  return lines.map(foldIcsLine).join('\r\n');
}

/**
 * The whole feed body for a set of shows, one show or many.
 *
 * `now` is injectable so a snapshot test can pin `DTSTAMP` rather than
 * asserting "some timestamp".
 */
export function buildCalendarFeed(
  shows: readonly CalendarShow[],
  options: { baseUrl: string; now?: Date } = { baseUrl: '' },
): string {
  const dtstamp = formatIcsTimestamp((options.now ?? new Date()).getTime());

  const events = shows
    .flatMap((show) => eventsForShow(show, options.baseUrl))
    // Sorted by start (T25). `Array#sort` is stable, but every event's start
    // is already distinct enough in practice that stability alone would not
    // save a broken comparator — the fixture this is tested against uses
    // shows whose date order differs from both name and id order.
    .sort((a, b) => a.start - b.start);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cinemadraft//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    ...events.map((event) => serializeEvent(event, dtstamp)),
    'END:VCALENDAR',
  ];

  return `${lines.join('\r\n')}\r\n`;
}
