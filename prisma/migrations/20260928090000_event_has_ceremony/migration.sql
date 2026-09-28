-- A show that names honourees and never holds a ceremony (the AFI: ten films
-- a year, 0 winner rows in any season). Until now this was knowledge in the
-- award-entry skill and an inference in the rail, which built a ceremony box
-- for it with no date and so read "11 of 12 shows complete · Next · date TBA"
-- for the rest of the year (D129). Default true: every other show has one.
ALTER TABLE "events" ADD COLUMN "has_ceremony" BOOLEAN NOT NULL DEFAULT true;
UPDATE "events" SET "has_ceremony" = false WHERE "abbreviation" = 'afi';
