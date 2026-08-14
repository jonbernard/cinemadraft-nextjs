// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { loadFixture } from '@/test/fixtures';

import { parseComponents, profileFeedRepository } from './profile-feeds';

afterAll(async () => {
  await db.$disconnect();
});

/** `GET /profile/feed/user/:uuid`, captured as user 3. */
type FixtureFeed = {
  feed: {
    componentsArray: [string, number][];
    id: number;
    message: string;
    icon: string;
    link: string;
    userUuid: string;
    components: string;
    createdAt: string;
    updatedAt: string;
  }[];
};

const fixture = loadFixture<FixtureFeed>('profile-feed');

/**
 * Resolved from the database rather than pasted in.
 *
 * `scripts/scrub-fixtures.mjs` rewrites every uuid, so the one in the fixture
 * addresses nobody in the restored data — and the real one is a user
 * identifier that has no business being committed to a test file. Everything
 * below asserts shape and ordering, never the message text, which is free
 * prose containing real first names.
 */
let uuid: string;

beforeAll(async () => {
  const [user] = await db.$queryRaw<{ uuid: string }[]>`
    select uuid::text as uuid from users where id = 3
  `;
  if (!user) throw new Error('user 3 is missing from the restored data');
  uuid = user.uuid;
});

describe('profileFeedRepository.findById', () => {
  it('returns the entry', async () => {
    const [row] = await db.$queryRaw<{ id: number }[]>`
      select id from profile_feeds order by id asc limit 1
    `;
    if (!row) throw new Error('profile_feeds is empty');

    const entry = await profileFeedRepository.findById(row.id);
    expect(entry.id).toBe(row.id);
  });

  it('throws NotFoundError for an id that does not exist', async () => {
    await expect(profileFeedRepository.findById(999_999)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(profileFeedRepository.findById(999_999)).rejects.toThrow(
      'profile feed 999999 not found',
    );
  });
});

describe('profileFeedRepository.findByUserUuid', () => {
  it('returns as many entries as the source API did', async () => {
    const feed = await profileFeedRepository.findByUserUuid(uuid);
    expect(feed).toHaveLength(fixture.feed.length);
    expect(feed.every((e) => e.userUuid === uuid)).toBe(true);
  });

  it('returns the newest first, using the database ordering', async () => {
    // The captured feed has three entries sharing one createdAt, and the API
    // returned them in whatever order the plan produced — 90, 135, 102, which
    // is neither id order nor stable across runs. The port breaks the tie on
    // id so the same request always renders the same page; asserting against
    // an explicit SQL ORDER BY is what checks that.
    const feed = await profileFeedRepository.findByUserUuid(uuid);

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from profile_feeds
      where user_uuid = ${uuid}
      order by created_at desc, id desc
    `;

    expect(feed.map((e) => e.id)).toEqual(ordered.map((r) => r.id));
    expect(feed.length).toBeGreaterThan(1);
  });

  it('returns an empty array for a uuid with no feed', async () => {
    expect(
      await profileFeedRepository.findByUserUuid('00000000-0000-0000-0000-000000000000'),
    ).toEqual([]);
  });

  it('returns an empty array rather than throwing on a malformed uuid', async () => {
    // user_uuid is plain text, not uuid — anything can be asked about, and a
    // route parameter reaches this method unvalidated.
    expect(await profileFeedRepository.findByUserUuid('not-a-uuid')).toEqual([]);
  });
});

describe('the DTO matches the captured contract', () => {
  it('carries exactly the fields the source API returned', async () => {
    const expected = fixture.feed[0];
    if (!expected) throw new Error('profile-feed fixture is empty');

    const [entry] = await profileFeedRepository.findByUserUuid(uuid);
    if (!entry) throw new Error('user 3 has no profile feed');

    expect(Object.keys(entry).sort()).toEqual(Object.keys(expected).sort());
  });

  it('parses components into the componentsArray the API exposed', async () => {
    const feed = await profileFeedRepository.findByUserUuid(uuid);

    for (const entry of feed) {
      expect(Array.isArray(entry.componentsArray)).toBe(true);
      for (const [kind, id] of entry.componentsArray) {
        expect(typeof kind).toBe('string');
        expect(typeof id).toBe('number');
      }
    }

    // Every captured entry references a draft, so the parse is doing work.
    expect(feed.some((e) => e.componentsArray.length > 0)).toBe(true);
  });

  it('parses the double-escaped rows the older writer produced', async () => {
    // Two spellings live in this column: `[["draft",110]]` and
    // `[[\"draft\",9]]`. The source model unescaped before parsing, which is
    // the only reason the older rows ever rendered.
    const [row] = await db.$queryRaw<{ id: number; components: string }[]>`
      select id, components from profile_feeds
      where components like '%\\\\"%' order by id asc limit 1
    `;
    if (!row) throw new Error('no double-escaped components row to test against');

    const entry = await profileFeedRepository.findById(row.id);

    expect(row.components).toContain('\\"');
    expect(entry.componentsArray).toEqual([['draft', expect.any(Number)]]);
    // The raw column is preserved alongside the parse, as the API returned it.
    expect(entry.components).toBe(row.components);
  });

  it('yields an empty componentsArray rather than throwing on unparseable text', () => {
    // `components` is free text with no constraint on it. The source model
    // called `.replace` on the value unguarded, so a null or malformed one
    // took down the whole profile page with a TypeError. An entry with no
    // usable components is not an error — it renders as a plain feed line.
    expect(parseComponents(null)).toEqual([]);
    expect(parseComponents('')).toEqual([]);
    expect(parseComponents('{not json')).toEqual([]);
    expect(parseComponents('"a string"')).toEqual([]);
    expect(parseComponents('[["draft"]]')).toEqual([]);
    expect(parseComponents('[["draft",7]]')).toEqual([['draft', 7]]);
  });

  it('returns Date objects, not the strings JSON gave us', async () => {
    const [entry] = await profileFeedRepository.findByUserUuid(uuid);
    expect(entry?.createdAt).toBeInstanceOf(Date);
  });

  it('returns no Prisma internals, and survives JSON.stringify', async () => {
    const [entry] = await profileFeedRepository.findByUserUuid(uuid);
    if (!entry) throw new Error('user 3 has no profile feed');

    expect(Object.getPrototypeOf(entry)).toBe(Object.prototype);
    expect(() => JSON.stringify(entry)).not.toThrow();
  });
});
