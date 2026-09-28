-- Each show's dates for each season (D134). events.nom_date/awards_date are
-- overwritten every year, so before this nothing said when a past season's
-- moments happened. No FK, like every table here (the schema has none).
CREATE TABLE "event_dates" (
  "id" SERIAL PRIMARY KEY,
  "year" INTEGER NOT NULL,
  "event_id" INTEGER NOT NULL,
  "nom_date" BIGINT, "nom_time" BIGINT,
  "awards_date" BIGINT, "awards_time" BIGINT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "event_dates_year_event_id_key" ON "event_dates" ("year", "event_id");

-- 2017-2026, from literals, NOT copied from events: by the time this runs the
-- skill may already have written 2027's dates into those columns. Researched
-- public announcement dates (owner, 2026-09-27); the 2026 rows equal what
-- events held on 2026-09-27, times included. History has no times.
--
-- Stored as epoch ms of UTC midnight of the day, like events.nom_date:
-- extract(epoch from a DATE) is its UTC midnight. The year is the season
-- (the 2026 season is Dec 2025 - Mar 2026). Conventions: AFI's "nominations"
-- are its honorees, and it has no ceremony; DGA, PGA and WGA are the film
-- nominations; the 2020 Razzies' ceremony was cancelled and winners were
-- posted on Mar 16; BAFTA 2021 ran over Apr 10-11, Apr 11 the main night.
--
-- 🔴 lib/repositories/event-dates.backfill.test.ts parses this VALUES list:
-- keep one row per line.
INSERT INTO "event_dates" ("year", "event_id", "nom_date", "nom_time", "awards_date", "awards_time")
SELECT v.year, e.id,
  (extract(epoch FROM v.nom) * 1000)::bigint, v.nom_time,
  (extract(epoch FROM v.awards) * 1000)::bigint, v.awards_time
FROM "events" e JOIN (VALUES
  -- 2017
  (2017, 'afi',    DATE '2016-12-08', NULL,     NULL,              NULL),
  (2017, 'gg',     DATE '2016-12-12', NULL,     DATE '2017-01-08', NULL),
  (2017, 'sag',    DATE '2016-12-14', NULL,     DATE '2017-01-29', NULL),
  (2017, 'ace',    DATE '2017-01-03', NULL,     DATE '2017-01-27', NULL),
  (2017, 'wga',    DATE '2017-01-04', NULL,     DATE '2017-02-19', NULL),
  (2017, 'adg',    DATE '2017-01-05', NULL,     DATE '2017-02-11', NULL),
  (2017, 'pga',    DATE '2017-01-10', NULL,     DATE '2017-01-28', NULL),
  (2017, 'bafta',  DATE '2017-01-10', NULL,     DATE '2017-02-12', NULL),
  (2017, 'asc',    DATE '2017-01-11', NULL,     DATE '2017-02-04', NULL),
  (2017, 'dga',    DATE '2017-01-12', NULL,     DATE '2017-02-04', NULL),
  (2017, 'raz',    DATE '2017-01-23', NULL,     DATE '2017-02-25', NULL),
  (2017, 'oscars', DATE '2017-01-24', NULL,     DATE '2017-02-26', NULL),
  -- 2018
  (2018, 'afi',    DATE '2017-12-07', NULL,     NULL,              NULL),
  (2018, 'gg',     DATE '2017-12-11', NULL,     DATE '2018-01-07', NULL),
  (2018, 'sag',    DATE '2017-12-13', NULL,     DATE '2018-01-21', NULL),
  (2018, 'ace',    DATE '2018-01-03', NULL,     DATE '2018-01-26', NULL),
  (2018, 'adg',    DATE '2018-01-04', NULL,     DATE '2018-01-27', NULL),
  (2018, 'wga',    DATE '2018-01-04', NULL,     DATE '2018-02-11', NULL),
  (2018, 'pga',    DATE '2018-01-05', NULL,     DATE '2018-01-20', NULL),
  (2018, 'asc',    DATE '2018-01-09', NULL,     DATE '2018-02-17', NULL),
  (2018, 'bafta',  DATE '2018-01-09', NULL,     DATE '2018-02-18', NULL),
  (2018, 'dga',    DATE '2018-01-11', NULL,     DATE '2018-02-03', NULL),
  (2018, 'raz',    DATE '2018-01-22', NULL,     DATE '2018-03-03', NULL),
  (2018, 'oscars', DATE '2018-01-23', NULL,     DATE '2018-03-04', NULL),
  -- 2019
  (2019, 'afi',    DATE '2018-12-04', NULL,     NULL,              NULL),
  (2019, 'gg',     DATE '2018-12-06', NULL,     DATE '2019-01-06', NULL),
  (2019, 'sag',    DATE '2018-12-12', NULL,     DATE '2019-01-27', NULL),
  (2019, 'pga',    DATE '2019-01-04', NULL,     DATE '2019-01-19', NULL),
  (2019, 'adg',    DATE '2019-01-07', NULL,     DATE '2019-02-02', NULL),
  (2019, 'asc',    DATE '2019-01-07', NULL,     DATE '2019-02-09', NULL),
  (2019, 'ace',    DATE '2019-01-07', NULL,     DATE '2019-02-01', NULL),
  (2019, 'wga',    DATE '2019-01-07', NULL,     DATE '2019-02-17', NULL),
  (2019, 'dga',    DATE '2019-01-08', NULL,     DATE '2019-02-02', NULL),
  (2019, 'bafta',  DATE '2019-01-09', NULL,     DATE '2019-02-10', NULL),
  (2019, 'raz',    DATE '2019-01-21', NULL,     DATE '2019-02-23', NULL),
  (2019, 'oscars', DATE '2019-01-22', NULL,     DATE '2019-02-24', NULL),
  -- 2020
  (2020, 'afi',    DATE '2019-12-04', NULL,     NULL,              NULL),
  (2020, 'gg',     DATE '2019-12-09', NULL,     DATE '2020-01-05', NULL),
  (2020, 'adg',    DATE '2019-12-09', NULL,     DATE '2020-02-01', NULL),
  (2020, 'sag',    DATE '2019-12-11', NULL,     DATE '2020-01-19', NULL),
  (2020, 'ace',    DATE '2019-12-11', NULL,     DATE '2020-01-17', NULL),
  (2020, 'asc',    DATE '2020-01-02', NULL,     DATE '2020-01-25', NULL),
  (2020, 'wga',    DATE '2020-01-06', NULL,     DATE '2020-02-01', NULL),
  (2020, 'dga',    DATE '2020-01-07', NULL,     DATE '2020-01-25', NULL),
  (2020, 'pga',    DATE '2020-01-07', NULL,     DATE '2020-01-18', NULL),
  (2020, 'bafta',  DATE '2020-01-07', NULL,     DATE '2020-02-02', NULL),
  (2020, 'oscars', DATE '2020-01-13', NULL,     DATE '2020-02-09', NULL),
  (2020, 'raz',    DATE '2020-02-08', NULL,     DATE '2020-03-16', NULL),
  -- 2021
  (2021, 'afi',    DATE '2021-01-25', NULL,     NULL,              NULL),
  (2021, 'gg',     DATE '2021-02-03', NULL,     DATE '2021-02-28', NULL),
  (2021, 'sag',    DATE '2021-02-04', NULL,     DATE '2021-04-04', NULL),
  (2021, 'wga',    DATE '2021-02-16', NULL,     DATE '2021-03-21', NULL),
  (2021, 'adg',    DATE '2021-02-25', NULL,     DATE '2021-04-10', NULL),
  (2021, 'pga',    DATE '2021-03-08', NULL,     DATE '2021-03-24', NULL),
  (2021, 'asc',    DATE '2021-03-09', NULL,     DATE '2021-04-18', NULL),
  (2021, 'dga',    DATE '2021-03-09', NULL,     DATE '2021-04-10', NULL),
  (2021, 'bafta',  DATE '2021-03-09', NULL,     DATE '2021-04-11', NULL),
  (2021, 'ace',    DATE '2021-03-11', NULL,     DATE '2021-04-17', NULL),
  (2021, 'raz',    DATE '2021-03-12', NULL,     DATE '2021-04-24', NULL),
  (2021, 'oscars', DATE '2021-03-15', NULL,     DATE '2021-04-25', NULL),
  -- 2022
  (2022, 'afi',    DATE '2021-12-08', NULL,     NULL,              NULL),
  (2022, 'gg',     DATE '2021-12-13', NULL,     DATE '2022-01-09', NULL),
  (2022, 'sag',    DATE '2022-01-12', NULL,     DATE '2022-02-27', NULL),
  (2022, 'adg',    DATE '2022-01-24', NULL,     DATE '2022-03-05', NULL),
  (2022, 'asc',    DATE '2022-01-25', NULL,     DATE '2022-03-20', NULL),
  (2022, 'dga',    DATE '2022-01-27', NULL,     DATE '2022-03-12', NULL),
  (2022, 'pga',    DATE '2022-01-27', NULL,     DATE '2022-03-19', NULL),
  (2022, 'ace',    DATE '2022-01-27', NULL,     DATE '2022-03-05', NULL),
  (2022, 'wga',    DATE '2022-01-27', NULL,     DATE '2022-03-20', NULL),
  (2022, 'bafta',  DATE '2022-02-03', NULL,     DATE '2022-03-13', NULL),
  (2022, 'raz',    DATE '2022-02-07', NULL,     DATE '2022-03-26', NULL),
  (2022, 'oscars', DATE '2022-02-08', NULL,     DATE '2022-03-27', NULL),
  -- 2023
  (2023, 'afi',    DATE '2022-12-09', NULL,     NULL,              NULL),
  (2023, 'gg',     DATE '2022-12-12', NULL,     DATE '2023-01-10', NULL),
  (2023, 'adg',    DATE '2023-01-09', NULL,     DATE '2023-02-18', NULL),
  (2023, 'asc',    DATE '2023-01-09', NULL,     DATE '2023-03-05', NULL),
  (2023, 'sag',    DATE '2023-01-11', NULL,     DATE '2023-02-26', NULL),
  (2023, 'dga',    DATE '2023-01-11', NULL,     DATE '2023-02-18', NULL),
  (2023, 'pga',    DATE '2023-01-12', NULL,     DATE '2023-02-25', NULL),
  (2023, 'bafta',  DATE '2023-01-19', NULL,     DATE '2023-02-19', NULL),
  (2023, 'raz',    DATE '2023-01-23', NULL,     DATE '2023-03-11', NULL),
  (2023, 'oscars', DATE '2023-01-24', NULL,     DATE '2023-03-12', NULL),
  (2023, 'wga',    DATE '2023-01-25', NULL,     DATE '2023-03-05', NULL),
  (2023, 'ace',    DATE '2023-02-01', NULL,     DATE '2023-03-05', NULL),
  -- 2024
  (2024, 'afi',    DATE '2023-12-07', NULL,     NULL,              NULL),
  (2024, 'gg',     DATE '2023-12-11', NULL,     DATE '2024-01-07', NULL),
  (2024, 'adg',    DATE '2024-01-09', NULL,     DATE '2024-02-10', NULL),
  (2024, 'sag',    DATE '2024-01-10', NULL,     DATE '2024-02-24', NULL),
  (2024, 'dga',    DATE '2024-01-10', NULL,     DATE '2024-02-10', NULL),
  (2024, 'asc',    DATE '2024-01-11', NULL,     DATE '2024-03-03', NULL),
  (2024, 'pga',    DATE '2024-01-12', NULL,     DATE '2024-02-25', NULL),
  (2024, 'bafta',  DATE '2024-01-18', NULL,     DATE '2024-02-18', NULL),
  (2024, 'raz',    DATE '2024-01-22', NULL,     DATE '2024-03-09', NULL),
  (2024, 'oscars', DATE '2024-01-23', NULL,     DATE '2024-03-10', NULL),
  (2024, 'ace',    DATE '2024-01-25', NULL,     DATE '2024-03-03', NULL),
  (2024, 'wga',    DATE '2024-02-21', NULL,     DATE '2024-04-14', NULL),
  -- 2025
  (2025, 'afi',    DATE '2024-12-05', NULL,     NULL,              NULL),
  (2025, 'gg',     DATE '2024-12-09', NULL,     DATE '2025-01-05', NULL),
  (2025, 'ace',    DATE '2024-12-11', NULL,     DATE '2025-03-14', NULL),
  (2025, 'sag',    DATE '2025-01-08', NULL,     DATE '2025-02-23', NULL),
  (2025, 'dga',    DATE '2025-01-08', NULL,     DATE '2025-02-08', NULL),
  (2025, 'adg',    DATE '2025-01-09', NULL,     DATE '2025-02-15', NULL),
  (2025, 'wga',    DATE '2025-01-15', NULL,     DATE '2025-02-15', NULL),
  (2025, 'bafta',  DATE '2025-01-15', NULL,     DATE '2025-02-16', NULL),
  (2025, 'asc',    DATE '2025-01-16', NULL,     DATE '2025-02-23', NULL),
  (2025, 'pga',    DATE '2025-01-16', NULL,     DATE '2025-02-08', NULL),
  (2025, 'raz',    DATE '2025-01-21', NULL,     DATE '2025-03-01', NULL),
  (2025, 'oscars', DATE '2025-01-23', NULL,     DATE '2025-03-02', NULL),
  -- 2026
  (2026, 'afi',    DATE '2025-12-04', 46800000, NULL,              NULL),
  (2026, 'gg',     DATE '2025-12-08', 46800000, DATE '2026-01-11', 90000000),
  (2026, 'sag',    DATE '2026-01-07', 54000000, DATE '2026-03-01', 90000000),
  (2026, 'adg',    DATE '2026-01-07', 46800000, DATE '2026-02-28', 90000000),
  (2026, 'asc',    DATE '2026-01-08', 46800000, DATE '2026-03-08', 90000000),
  (2026, 'dga',    DATE '2026-01-08', 46800000, DATE '2026-02-07', 90000000),
  (2026, 'pga',    DATE '2026-01-09', 46800000, DATE '2026-02-28', 90000000),
  (2026, 'raz',    DATE '2026-01-21', 46800000, DATE '2026-03-14', 90000000),
  (2026, 'oscars', DATE '2026-01-22', 46800000, DATE '2026-03-15', 91800000),
  (2026, 'ace',    DATE '2026-01-27', 46800000, DATE '2026-02-27', 90000000),
  (2026, 'wga',    DATE '2026-01-27', 57600000, DATE '2026-03-08', 90000000),
  (2026, 'bafta',  DATE '2026-01-27', 46800000, DATE '2026-02-22', 90000000)
) AS v(year, abbr, nom, nom_time, awards, awards_time) ON e.abbreviation = v.abbr;
