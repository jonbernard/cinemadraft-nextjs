-- Point the twelve award-show logos back at Vercel Blob (PLAN.md § Phase 13 T3).
--
-- A restore from the Heroku dump puts `events.image` back to the old
-- `/images/awards/*.jpg` paths. The Blob objects Phase 11 uploaded are
-- untouched, at deterministic paths, so this is a plain idempotent update.
-- Applied by scripts/restore-from-heroku.sh, which then checks 12 of 12.
UPDATE events SET image = 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/ace.jpg'    WHERE abbreviation = 'ace';
UPDATE events SET image = 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/adg.jpg'    WHERE abbreviation = 'adg';
UPDATE events SET image = 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/afi.png'    WHERE abbreviation = 'afi';
UPDATE events SET image = 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/asc.jpg'    WHERE abbreviation = 'asc';
UPDATE events SET image = 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/bafta.jpg'  WHERE abbreviation = 'bafta';
UPDATE events SET image = 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/dga.jpg'    WHERE abbreviation = 'dga';
UPDATE events SET image = 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/gg.jpg'     WHERE abbreviation = 'gg';
UPDATE events SET image = 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/oscars.jpg' WHERE abbreviation = 'oscars';
UPDATE events SET image = 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/pga.jpg'    WHERE abbreviation = 'pga';
UPDATE events SET image = 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/raz.jpg'    WHERE abbreviation = 'raz';
UPDATE events SET image = 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/sag.jpg'    WHERE abbreviation = 'sag';
UPDATE events SET image = 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/wga.jpg'    WHERE abbreviation = 'wga';
