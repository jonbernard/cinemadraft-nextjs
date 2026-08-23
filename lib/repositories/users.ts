import { randomUUID } from 'node:crypto';

import type { UserRole } from '@/generated/prisma/enums';
import type { UserModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { ConflictError, NotFoundError } from '@/lib/errors';

/**
 * Re-exported so callers can type a role without reaching into `generated/`.
 * Nothing outside this layer should know Prisma generated it.
 */
export type { UserRole };

/**
 * A user, shaped as the database stores one.
 *
 * The field list is written out rather than taken wholesale from the Prisma
 * model so the repository boundary is real: adding a column to the database
 * does not silently widen what every component receives. The field *types*
 * come from the generated model, so they cannot drift from the schema.
 *
 * This is deliberately wider than any fixture. The source API had four
 * different user shapes depending on the route — the draft roster returned
 * five fields, the public profile returned four and a computed name — because
 * projection happened in the query. A repository returns the row; choosing
 * what a response exposes is the caller's job.
 *
 * No `displayName`. The Sequelize model carried a VIRTUAL
 * `${firstName} ${lastName}`, which is why the profile fixture has one, but
 * some rows hold unnormalized names and display formatting belongs in one
 * place — the same reasoning that keeps absolute poster URLs off `Movie`.
 *
 * Three fields need saying out loud, because they are the sensitive ones:
 *
 * - `email` is real data. It is also the only identifier a legacy account can
 *   be claimed by (D25), so it cannot be dropped from the read model.
 * - `provider` is how the account was originally created — `auth0` or
 *   `google.com`.
 * - `providerId` is the Auth0 subject, e.g. `auth0|61e4…`. Phase 4 retires it:
 *   Clerk replaces Auth0, and once every active account is claimed the column
 *   is dead weight. Until then it is the only link back to the legacy
 *   identity, so it stays.
 *
 * `clerkId` is the newest field and is in no fixture: it is set when a Clerk
 * identity claims the account (D25), and is null on every restored row because
 * there was no bulk migration. Callers must treat unclaimed as normal.
 */
export type User = Pick<
  UserModel,
  | 'id'
  | 'uuid'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'role'
  | 'image'
  | 'provider'
  | 'providerId'
  | 'lastLogin'
  | 'createdAt'
  | 'updatedAt'
  | 'clerkId'
>;

const SELECT = {
  id: true,
  uuid: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  image: true,
  provider: true,
  providerId: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
  clerkId: true,
} as const;

/**
 * Email identity is case-insensitive in practice and case-sensitive in this
 * column: one restored account was stored with mixed case, and Clerk hands
 * back a lower-cased address on a verified identity. An exact match would
 * leave that person permanently unable to claim their own account.
 *
 * Safe because the addresses are unique even after case folding — checked
 * against the restored data — but `claim` still refuses to guess if that ever
 * stops being true.
 */
function byEmail(email: string) {
  return { email: { equals: email, mode: 'insensitive' } } as const;
}

export const userRepository = {
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<User> {
    const user = await db.user.findUnique({ where: { id }, select: SELECT });
    if (!user) throw new NotFoundError('user', id);
    return user;
  },

  /**
   * Returns null on a miss: the public profile URL carries a uuid, so a miss
   * is a mistyped or stale link rather than a broken invariant.
   */
  async findByUuid(uuid: string): Promise<User | null> {
    return db.user.findUnique({ where: { uuid }, select: SELECT });
  },

  /**
   * Returns null on a miss: a brand new Clerk signup has no legacy account,
   * and that is the normal path, not an error.
   */
  async findByEmail(email: string): Promise<User | null> {
    return db.user.findFirst({ where: byEmail(email), select: SELECT });
  },

  /**
   * Returns null on a miss: on first sign-in nobody has claimed the account
   * yet, which is exactly what the caller is asking about.
   */
  async findByClerkId(clerkId: string): Promise<User | null> {
    return db.user.findUnique({ where: { clerkId }, select: SELECT });
  },

  /**
   * Batch-load by id, skipping ids that do not resolve.
   *
   * Accepts bigint because this schema has no foreign keys and the referencing
   * columns disagree on width: users.id is integer, but notifications.user_id
   * and watchlists.user_id are both bigint. A dangling reference is therefore
   * possible, and must not take down a page render.
   */
  async findManyByIds(ids: readonly (number | bigint)[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return db.user.findMany({
      where: { id: { in: ids.map(Number) } },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
  },

  /**
   * Attach a Clerk identity to the legacy account with this email (D25).
   *
   * The caller must have verified the address with Clerk first. Claiming on an
   * unverified email is an account-takeover vector: anyone able to type
   * someone else's address would inherit their leagues, drafts and history.
   * This function cannot check that — it only sees a string — so the caller
   * carries it.
   *
   * The write is conditional on the account still being unclaimed, so two
   * concurrent sign-ins cannot both succeed. Re-claiming by the identity that
   * already holds the account is a no-op: Clerk redelivers webhooks, and a
   * retry should not be an error the caller has to special-case.
   */
  async claim(email: string, clerkId: string): Promise<User> {
    const matches = await db.user.findMany({ where: byEmail(email), select: SELECT });
    if (matches.length > 1) {
      // Unreachable while the addresses stay unique after case folding. If it
      // ever fires, guessing which account to hand over is the one thing this
      // function must never do.
      throw new ConflictError(`more than one account uses ${email}`);
    }

    const existing = matches[0];
    if (!existing) throw new NotFoundError('user', email);

    const { count } = await db.user.updateMany({
      where: { id: existing.id, clerkId: null },
      data: { clerkId },
    });
    if (count === 1) return { ...existing, clerkId };

    // The account was already claimed, either long ago or by a sign-in that
    // raced this one. Re-read rather than trusting the row we started from.
    const current = await db.user.findUnique({
      where: { id: existing.id },
      select: SELECT,
    });
    if (!current) throw new NotFoundError('user', existing.id);
    if (current.clerkId !== clerkId) {
      throw new ConflictError(`user ${current.id} is already claimed`);
    }
    return current;
  },

  /**
   * Create a row for a Clerk identity that has no legacy account (D25).
   *
   * `uuid`, `createdAt` and `updatedAt` are written explicitly because those
   * columns are nullable with **no database default** — Sequelize populated
   * them, and Prisma will happily insert nulls in its place. All 60 restored
   * rows have them, so a null here produces a user that is subtly unlike every
   * other one: no public profile URL, and no creation date to sort by. It
   * fails much later and far from this function.
   *
   * `provider` records how the account came into being. Legacy rows say
   * `auth0` or `google.com`; these say `clerk`, so the two populations stay
   * distinguishable after Auth0 is decommissioned and `providerId` goes dead.
   */
  async createFromClerk(input: {
    clerkId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    image: string | null;
  }): Promise<User> {
    const now = new Date();
    return db.user.create({
      data: {
        uuid: randomUUID(),
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        image: input.image,
        clerkId: input.clerkId,
        provider: 'clerk',
        role: 'user',
        createdAt: now,
        updatedAt: now,
        lastLogin: now,
      },
      select: SELECT,
    });
  },

  /**
   * Every user id, for the admin broadcast (T45) — it writes one row per
   * user, and pulling a whole row per user to discard everything but the id
   * is a waste that only grows with the table.
   */
  async findAllIds(): Promise<number[]> {
    const rows = await db.user.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
    return rows.map((row) => row.id);
  },

  /**
   * Admin repair: move an account to a different Clerk identity, or detach it.
   *
   * Deliberately unconditional, unlike `claim`. This exists precisely for the
   * cases the safety rules refuse — a member whose Clerk email differs from
   * their historical one, and a logged collision — so it is the one function
   * here that can transfer an account between people.
   *
   * That makes it the most dangerous function in this file. Every caller must
   * be behind `requireAdmin`. Passing null detaches rather than deletes, so a
   * mistaken relink is recoverable.
   */
  async relink(userId: number, clerkId: string | null): Promise<User> {
    const existing = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError('user', userId);
    return db.user.update({ where: { id: userId }, data: { clerkId }, select: SELECT });
  },
};
