-- `nominations.year` becomes an integer, like every other year column.
--
-- 🔴 It was the only one that was not, and the inconsistency was not
-- theoretical: it produced silent wrong answers three times during the port.
-- `Number(nomination.year) === year` is required everywhere the column is
-- compared, and the failure mode when it is forgotten is not an error — it is
-- an empty result. A film simply scores nothing, and no page says why.
--
-- Every call site was carrying a `String()` or `Number()` conversion to work
-- around it, which is a workaround repeated ten times rather than a fix.
--
-- Safe and lossless, verified against the restored data before writing this:
-- 4,559 rows, **zero nulls**, **zero non-numeric values**, range 2017–2026.
-- The USING clause is a straight cast, and Postgres rewrites the table — which
-- at 4,559 rows is instantaneous.
--
-- The index is dropped and recreated because its operator class is tied to the
-- column type; leaving it would leave a text-pattern index on an integer.
DROP INDEX IF EXISTS "nominations_year";

ALTER TABLE "nominations"
  ALTER COLUMN "year" TYPE integer USING "year"::integer;

CREATE INDEX "nominations_year" ON "nominations"("year");
