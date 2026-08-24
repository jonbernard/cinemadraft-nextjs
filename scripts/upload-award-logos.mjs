#!/usr/bin/env node
// Upload the twelve award-show logos to Vercel Blob and point events.image at
// them.
//
//   BLOB_READ_WRITE_TOKEN=… DATABASE_URL=… node scripts/upload-award-logos.mjs [srcDir]
//
// srcDir defaults to ../cinemadraft/public/images/awards, the source app's
// checkout. Idempotent: a row already holding a Blob URL is skipped, so a run
// interrupted halfway resumes where it stopped.
//
// 🔴 Run it once per database. The Blob store is shared, but events.image is
// per-database — the local restored copy and Neon each need a pass, or the E2E
// suite and production disagree about where a logo lives.
//
// 🔴 The token is a write credential for the whole store. Keep it in
// .env.local (gitignored), and delete it from the Vercel dashboard once this
// phase is done: nothing in the running app writes to Blob.

import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const BLOB_HOST_MARK = '.public.blob.vercel-storage.com';

/** The file in `files` that holds this row's artwork, or null to skip. */
export function sourceFileFor(row, files) {
  const image = row.image ?? '';
  if (image.includes(BLOB_HOST_MARK)) return null;

  const named = image.startsWith('/') ? basename(image) : `${row.abbreviation}.jpg`;
  return files.includes(named) ? named : null;
}

/** The content type, read from the magic bytes rather than the file name. */
export function contentTypeOf(bytes) {
  const [a, b, c, d] = bytes;
  if (a === 0x89 && b === 0x50 && c === 0x4e && d === 0x47) return 'image/png';
  if (a === 0xff && b === 0xd8 && c === 0xff) return 'image/jpeg';
  return null;
}

async function main() {
  const { put } = await import('@vercel/blob');
  const { Client } = await import('pg');
  const { readdirSync } = await import('node:fs');

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error(
      'BLOB_READ_WRITE_TOKEN is not set. Create one in the Vercel dashboard\n' +
        '(Storage → the Blob store → Tokens), put it in .env.local, and delete it\n' +
        'again when this phase is done.',
    );
    process.exit(1);
  }

  const srcDir = resolve(
    process.argv[2] ??
      join(import.meta.dirname, '..', '..', 'cinemadraft', 'public', 'images', 'awards'),
  );
  const files = readdirSync(srcDir);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      'select id, abbreviation, image from events order by abbreviation',
    );

    for (const row of rows) {
      const file = sourceFileFor(row, files);
      if (!file) {
        console.log(`· ${row.abbreviation} — skipped (${row.image ?? 'no image'})`);
        continue;
      }

      const bytes = readFileSync(join(srcDir, file));
      const contentType = contentTypeOf(bytes);
      if (!contentType) {
        console.error(`✗ ${row.abbreviation} — ${file} is neither JPEG nor PNG`);
        process.exitCode = 1;
        continue;
      }

      const extension = contentType === 'image/png' ? 'png' : 'jpg';
      // A stable pathname, not a random suffix: these are public marks, not
      // avatars, and a deterministic URL makes a re-run overwrite in place
      // instead of littering the store with orphans.
      const { url } = await put(`award-shows/${row.abbreviation}.${extension}`, bytes, {
        access: 'public',
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
        token,
      });

      await client.query('update events set image = $1 where id = $2', [url, row.id]);
      console.log(`✓ ${row.abbreviation} — ${url}`);
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  await main();
}
