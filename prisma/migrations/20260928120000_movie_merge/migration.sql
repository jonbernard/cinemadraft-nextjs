-- Merge every movies row that shares a tmdb_id into its oldest (lowest id),
-- then make tmdb_id unique so the look-up-then-insert race cannot recur (D132).
--
-- Generic by tmdb_id, never by literal ids: Heroku keeps writing until
-- cutover, and its watchlist race can make new pairs before then.
--
-- A function, not inline SQL, so a CI test can run it inside a rolled-back
-- transaction (lib/repositories/movie-merge.test.ts). Once the unique index
-- exists it can never find anything to do, so it stays in the schema.
CREATE FUNCTION merge_duplicate_movies() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE removed integer;
BEGIN
  CREATE TEMP TABLE movie_merge ON COMMIT DROP AS
  SELECT id AS loser, keeper FROM (
    SELECT id, min(id) OVER (PARTITION BY tmdb_id) AS keeper FROM movies WHERE tmdb_id IS NOT NULL
  ) ranked WHERE id <> keeper;

  -- "One film twice in the same draft": the group's draft room, which also
  -- covers one seat holding both copies. A person decides, not the migration.
  -- (Once per *group* is normal: every group drafts the same pool.)
  IF EXISTS (
    SELECT 1 FROM draft_picks p JOIN drafts d ON d.id = p.draft_id
      LEFT JOIN movie_merge m ON m.loser = p.movie_id
     GROUP BY d.league_id, d.year, d."group", coalesce(m.keeper, p.movie_id)
    HAVING count(*) > 1 AND bool_or(m.loser IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'movie merge: one film is drafted twice in a league-season-group; resolve by hand';
  END IF;

  UPDATE nominations t SET movie_id = m.keeper FROM movie_merge m WHERE t.movie_id = m.loser;
  UPDATE winners     t SET movie_id = m.keeper FROM movie_merge m WHERE t.movie_id = m.loser;
  UPDATE draft_picks t SET movie_id = m.keeper FROM movie_merge m WHERE t.movie_id = m.loser;
  UPDATE lists       t SET movie_id = m.keeper FROM movie_merge m WHERE t.movie_id = m.loser;
  UPDATE reviews     t SET movie_id = m.keeper FROM movie_merge m WHERE t.movie_id = m.loser;
  UPDATE watchlists  t SET movie_id = m.keeper FROM movie_merge m WHERE t.movie_id = m.loser;

  -- A member who had marked both copies now has two rows for one film; keep
  -- the earliest. Scoped to merged films only.
  DELETE FROM watchlists w USING watchlists e WHERE w.user_id = e.user_id AND w.movie_id = e.movie_id
     AND w.id > e.id AND w.movie_id IN (SELECT keeper FROM movie_merge);
  DELETE FROM reviews w USING reviews e WHERE w.user_id = e.user_id AND w.movie_id = e.movie_id
     AND w.id > e.id AND w.movie_id IN (SELECT keeper FROM movie_merge);
  DELETE FROM lists w USING lists e WHERE w.user_id = e.user_id AND w.movie_id = e.movie_id
     AND w.year = e.year AND w.id > e.id AND w.movie_id IN (SELECT keeper FROM movie_merge);

  DELETE FROM movies WHERE id IN (SELECT loser FROM movie_merge);
  GET DIAGNOSTICS removed = ROW_COUNT;
  DROP TABLE movie_merge;
  RETURN removed;
END $$;

SELECT merge_duplicate_movies();
DROP INDEX IF EXISTS movies_tmdb_id;
CREATE UNIQUE INDEX movies_tmdb_id_key ON movies (tmdb_id);
