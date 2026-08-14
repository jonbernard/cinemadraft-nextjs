import type { AvailableYearModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { ConflictError, NotFoundError } from '@/lib/errors';

/**
 * A season the app has data for.
 *
 * The field list is explicit so a new column cannot silently widen the DTO;
 * the types come from the generated model.
 */
export type AvailableYear = Pick<
  AvailableYearModel,
  'id' | 'year' | 'isActive' | 'createdAt' | 'updatedAt'
>;

const SELECT = {
  id: true,
  year: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Postgres unique violation.
 *
 * Only `available_years_one_active` can raise it on this table, and only when
 * a second row is being flagged active — so it means exactly one thing here.
 */
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  // Prisma's own code, reported when the write went through the query API.
  if ((error as { code?: unknown }).code === 'P2002') return true;

  // The driver's SQLSTATE, which is where the truth lives when Prisma reports
  // the generic P2010 — a raw statement, or anything it could not attribute to
  // a model. Reading it directly means this does not depend on which path the
  // write took.
  const cause = (
    error as {
      meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } };
    }
  ).meta?.driverAdapterError?.cause;

  return cause?.originalCode === UNIQUE_VIOLATION;
}

export const availableYearRepository = {
  /** Every season, newest first. */
  async findAll(): Promise<AvailableYear[]> {
    return db.availableYear.findMany({ select: SELECT, orderBy: { year: 'desc' } });
  },

  /**
   * Just the years, which is all the year picker needs — and all the source
   * API ever returned from `GET /years`.
   *
   * `year` is nullable, so a null row is dropped rather than rendered as a
   * blank option.
   */
  async listYears(): Promise<number[]> {
    const rows = await db.availableYear.findMany({
      where: { year: { not: null } },
      select: { year: true },
      orderBy: { year: 'desc' },
    });
    return rows.flatMap((row) => (row.year === null ? [] : [row.year]));
  },

  /**
   * The season the app defaults to (D22).
   *
   * This read replaces `NEXT_PUBLIC_ACTIVE_YEAR`, which was baked in at build
   * time and therefore forced a redeploy every January. Returns null rather
   * than throwing when nothing is flagged: that is what the table looked like
   * before the seeding migration, and a caller falling back to the newest year
   * is a better failure than a blank site.
   */
  async findActive(): Promise<AvailableYear | null> {
    return db.availableYear.findFirst({ where: { isActive: true }, select: SELECT });
  },

  /**
   * Move the active season.
   *
   * The clear and the set are one transaction because the database allows only
   * one active row: `available_years_one_active`, a partial unique index on
   * (is_active) WHERE is_active, added in
   * `prisma/migrations/20260814130000_app_columns/migration.sql`. Setting
   * before clearing would fail every time, and doing either without the other
   * would leave the app with no active season at all.
   *
   * The invariant is enforced by the database rather than here on purpose — it
   * then holds against a concurrent writer, an admin in psql, and any future
   * code path that forgets. This method's job is to keep a concurrent writer's
   * rejection from reaching the client as a raw Postgres error, which is how
   * the source app leaked its schema on every failed query.
   */
  async setActive(year: number): Promise<AvailableYear> {
    try {
      return await db.$transaction(async (tx) => {
        const target = await tx.availableYear.findFirst({
          where: { year },
          select: { id: true },
        });
        if (!target) throw new NotFoundError('available year', year);

        await tx.availableYear.updateMany({
          where: { isActive: true, id: { not: target.id } },
          data: { isActive: false },
        });

        return tx.availableYear.update({
          where: { id: target.id },
          data: { isActive: true },
          select: SELECT,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          `another season is already active; ${year} was not activated`,
        );
      }
      throw error;
    }
  },
};
