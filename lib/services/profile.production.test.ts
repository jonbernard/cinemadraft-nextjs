// @vitest-environment node

import { afterAll, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { parseComponents } from '@/lib/repositories/profile-feeds';
import { loadMemberProfile } from './profile';

/**
 * The restored `profile_feeds` table, read as captured (P10.T40).
 *
 * 🔴 Trap 6 measured rather than assumed. 89 of the 125 rows hold the legacy
 * double-escaped spelling written by an older version of the source; the source
 * model's `componentsArray` getter unescaped before parsing and did it unguarded,
 * so it threw out of a getter for anything it could not read. This is the
 * evidence that both spellings resolve here.
 *
 * Excluded from `vitest.ci.config.mts` — CI has the schema and none of this data.
 */

afterAll(async () => {
  await db.$disconnect();
});

it('every restored row resolves to at least one component', async () => {
  const rows = await db.profileFeed.findMany({ select: { id: true, components: true } });

  expect(rows).toHaveLength(125);
  expect(rows.filter((row) => parseComponents(row.components).length === 0)).toEqual([]);
});

it('the legacy double-escaped spelling is the majority of the table', async () => {
  const rows = await db.profileFeed.findMany({ select: { components: true } });
  const legacy = rows.filter((row) => row.components?.includes('\\"'));

  expect(legacy).toHaveLength(89);
  expect(legacy.every((row) => parseComponents(row.components)[0]?.[0] === 'draft')).toBe(
    true,
  );
});

it('a real member’s profile resolves its draft components to films', async () => {
  const row = await db.profileFeed.findFirst({
    where: { userUuid: { not: null } },
    select: { userUuid: true },
    orderBy: { id: 'asc' },
  });
  const profile = await loadMemberProfile(row?.userUuid as string);

  expect(profile).not.toBeNull();
  expect(profile?.feed.length).toBeGreaterThan(0);

  const films = profile?.feed
    .flatMap((item) => item.attachments)
    .flatMap((attachment) => (attachment.kind === 'draft' ? attachment.films : []));

  expect(films?.length).toBeGreaterThan(0);
  expect(films?.every((film) => film.title.length > 0)).toBe(true);
});
