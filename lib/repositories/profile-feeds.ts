import type { ProfileFeedModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

/**
 * A reference from a feed line to something renderable, e.g. `['draft', 110]`.
 *
 * The kind is left as a plain string rather than a union: the column is free
 * text written by several code paths over the years — drafts and reviews so
 * far — and a value outside a union would be a lie the type system cannot
 * catch. Callers match on the kinds they know and ignore the rest.
 */
export type ProfileFeedComponent = [kind: string, id: number];

/**
 * One line on a public profile page.
 *
 * The field list is explicit so a new column cannot silently widen the DTO;
 * the types come from the generated model, plus the derived `componentsArray`.
 *
 * `message` is free prose containing real user names ("Ada drafted these
 * movies in the 2024 …"). It is displayed as captured, never parsed, and
 * `fixtures/profile-feed.json` carries scrubbed names — so no test may assert
 * its text.
 */
export type ProfileFeed = Pick<
  ProfileFeedModel,
  | 'id'
  | 'message'
  | 'icon'
  | 'link'
  | 'components'
  | 'userUuid'
  | 'createdAt'
  | 'updatedAt'
> & {
  /**
   * `components` parsed. The source app exposed this as a Sequelize VIRTUAL
   * column, so it is part of the captured contract, and the raw string is kept
   * beside it exactly as the API returned both.
   */
  componentsArray: ProfileFeedComponent[];
};

const SELECT = {
  id: true,
  message: true,
  icon: true,
  link: true,
  components: true,
  userUuid: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Two spellings live in this column: `[["draft",110]]` from the current writer
 * and `[[\"draft\",9]]` from an older one that JSON-encoded the value twice.
 * The source model unescaped before parsing, which is the only reason the
 * older rows ever rendered — and it did so unguarded, so a null or malformed
 * value threw a TypeError out of a getter and took down the whole profile
 * page. Anything unparseable is no components, not an error.
 */
export function parseComponents(components: string | null): ProfileFeedComponent[] {
  if (!components) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(components.replace(/\\"/g, '"'));
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.filter(
    (entry): entry is ProfileFeedComponent =>
      Array.isArray(entry) &&
      entry.length === 2 &&
      typeof entry[0] === 'string' &&
      typeof entry[1] === 'number',
  );
}

type Row = Omit<ProfileFeed, 'componentsArray'>;

function toDto(row: Row): ProfileFeed {
  return { ...row, componentsArray: parseComponents(row.components) };
}

export const profileFeedRepository = {
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<ProfileFeed> {
    const entry = await db.profileFeed.findUnique({ where: { id }, select: SELECT });
    if (!entry) throw new NotFoundError('profile feed', id);
    return toDto(entry);
  },

  /**
   * A profile's feed, newest first.
   *
   * Keyed by uuid rather than id because the profile route is public and a
   * sequential user id in a URL invites enumeration.
   *
   * `id` breaks the ties the captured feed is full of — the draft writer
   * inserts several rows in one statement, and the source API returned those
   * in whatever order the plan happened to produce, so the same profile could
   * render differently on two loads.
   *
   * `user_uuid` is plain text, not `uuid`, so an unparseable value is a miss
   * rather than a database error: this method is reached straight from a route
   * parameter.
   */
  async findByUserUuid(uuid: string): Promise<ProfileFeed[]> {
    const rows = await db.profileFeed.findMany({
      where: { userUuid: uuid },
      select: SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toDto);
  },

  /**
   * Add one line to a member's feed.
   *
   * `components` is serialized here rather than by the caller so the column and
   * `parseComponents` cannot drift apart: one function writes the string and one
   * reads it. `JSON.stringify` emits the single-escaped spelling, which is the
   * one 36 of the 125 restored rows use; the other 89 are the legacy
   * double-escaped form and are read, never written.
   *
   * The timestamps are explicit because the columns carry no database default —
   * the source set them in Sequelize, and a row inserted without them would sort
   * last forever under `createdAt desc`.
   */
  async create(input: {
    userUuid: string;
    message: string;
    icon?: string | null;
    link?: string | null;
    components?: readonly ProfileFeedComponent[];
    createdAt?: Date;
  }): Promise<ProfileFeed> {
    const now = new Date();
    const created = await db.profileFeed.create({
      data: {
        userUuid: input.userUuid,
        message: input.message,
        icon: input.icon ?? null,
        link: input.link ?? null,
        components: JSON.stringify(input.components ?? []),
        createdAt: input.createdAt ?? now,
        updatedAt: now,
      },
      select: SELECT,
    });
    return toDto(created);
  },

  /**
   * Remove one line from one member's feed.
   *
   * 🔴 `deleteMany` scoped by both columns, and the uuid is not optional. A feed
   * id arrives from the client, so it is a request rather than proof of
   * ownership; matching on the pair means another member's row is not reachable
   * from here even with a guessed id. Returns whether a row went, so a caller
   * can tell "not yours" from "already gone" — `deleteMany` refuses silently.
   */
  async deleteByIdAndUserUuid(id: number, userUuid: string): Promise<boolean> {
    const { count } = await db.profileFeed.deleteMany({ where: { id, userUuid } });
    return count > 0;
  },
};
