-- AlterTable
ALTER TABLE "available_years" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "movies" ADD COLUMN     "accent_hex" VARCHAR(7);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "clerk_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id");


-- At most one active year (D22).
--
-- Prisma cannot express a partial index in the schema, so this is hand-added
-- here and recorded in a doc comment on AvailableYear.isActive. Enforcing it
-- in the database rather than in application code means the invariant holds
-- against concurrent writes, an admin using psql, and any future code path
-- that forgets — which is the whole point of moving the active year out of an
-- environment variable.
--
-- The index is on (is_active) WHERE is_active, so it constrains only the true
-- rows. Any number of years may be false.
CREATE UNIQUE INDEX "available_years_one_active"
  ON "available_years" ("is_active")
  WHERE "is_active";

-- Seed the current active season, carried over from NEXT_PUBLIC_ACTIVE_YEAR.
-- That environment variable is deleted at P5.T0, once the database-backed read
-- path ships.
UPDATE "available_years" SET "is_active" = true WHERE "year" = 2026;
