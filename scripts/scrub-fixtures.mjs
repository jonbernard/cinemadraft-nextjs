#!/usr/bin/env node
// Scrub personal data out of the captured API fixtures.
//
//   node scripts/scrub-fixtures.mjs
//
// Reads  .local/fixtures/   (raw capture — gitignored, real user data)
// Writes fixtures/          (scrubbed — committed, safe, what CI reads)
//
// Contract tests assert response *shape* — field names, types, nesting, sort
// order, and the scoring arithmetic. None of that depends on anyone's real
// name, so the raw values can be replaced as long as three things hold:
//
//   1. Determinism. The same input always produces the same output, so
//      re-running never churns the diff.
//   2. Referential integrity. One person maps to one identity everywhere.
//      A uuid in points-league-total must still match the same user in
//      user-drafts, or cross-fixture assertions break.
//   3. Shape preservation. A uuid stays uuid-shaped, an email stays
//      email-shaped, a Gravatar URL stays a URL.
//
// Domain data is NOT scrubbed: award and event names, and TMDB cast names
// (original_name, detailName) which are public and load-bearing in tests.

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, '.local', 'fixtures');
const DEST = join(ROOT, 'fixtures');

// Keys holding user-identifying values. Exact match only — `name` is an award
// name and must survive untouched.
const PERSONA_KEYS = new Set([
  'firstName',
  'lastName',
  'displayName',
  'dummyName',
  'email',
  'image',
]);
const ID_KEYS = new Set(['uuid', 'userUuid', 'providerId']);

const FIRST_POOL = [
  'Ava',
  'Miles',
  'Nora',
  'Theo',
  'Iris',
  'Owen',
  'Ruth',
  'Cole',
  'Vera',
  'Emmet',
  'Juno',
  'Silas',
  'Hazel',
  'Rex',
  'Opal',
  'Dov',
  'Wren',
  'Abel',
  'Greta',
  'Cyrus',
];
const LAST_POOL = [
  'Reed',
  'Marsh',
  'Vance',
  'Okoye',
  'Bright',
  'Nakamura',
  'Ellis',
  'Duarte',
  'Fenn',
  'Alvi',
  'Sloane',
  'Petrov',
  'Chan',
  'Rivas',
  'Holt',
  'Ibarra',
  'Quinn',
  'Osei',
  'Lund',
  'Baqri',
];

const digest = (s) => createHash('sha256').update(String(s)).digest();
const pick = (arr, seed, offset = 0) =>
  arr[digest(seed).readUInt32BE(offset) % arr.length];

// ------------------------------------------------------- load + pre-scan

let files;
try {
  files = readdirSync(SRC).filter((f) => f.endsWith('.json'));
} catch {
  console.error(`No raw fixtures at ${SRC}\nRun scripts/capture-fixtures.sh first.`);
  process.exit(1);
}
if (files.length === 0) {
  console.error(`No .json files in ${SRC}`);
  process.exit(1);
}
const raw = new Map(
  files.map((f) => [f, JSON.parse(readFileSync(join(SRC, f), 'utf8'))]),
);

// Collect every real personal-name token up front so the fake pools can be
// made disjoint from them. Without this a generated surname can collide with
// a real one — "Ellis" is both a pool entry and an actual user's last name —
// which would quietly reintroduce a genuine name into the "scrubbed" output.
const realNames = new Set();
{
  const NAME_KEYS = ['firstName', 'lastName', 'displayName', 'dummyName'];
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    for (const [k, v] of Object.entries(n)) {
      if (NAME_KEYS.includes(k) && typeof v === 'string') {
        for (const part of v.split(/\s+/)) if (part) realNames.add(part.toLowerCase());
      }
      walk(v);
    }
  };
  for (const doc of raw.values()) walk(doc);
}

const FIRST = FIRST_POOL.filter((n) => !realNames.has(n.toLowerCase()));
const LAST = LAST_POOL.filter((n) => !realNames.has(n.toLowerCase()));
if (FIRST.length < 4 || LAST.length < 4) {
  console.error('Name pools too depleted after removing real names — add more entries.');
  process.exit(1);
}

// ---------------------------------------------------------------- personas

// A person is identified by their normalized full name, so an object carrying
// {firstName:'Jon', lastName:'Bernard'} and one carrying
// {displayName:'Jon Bernard'} resolve to the same persona.
const personas = new Map();

const takenNames = new Set();

function persona(key) {
  const k = String(key).trim().toLowerCase().replace(/\s+/g, ' ');
  if (personas.has(k)) return personas.get(k);

  // Probe deterministically until the full name is unused. Two real people
  // colliding on one fake identity would merge them in cross-fixture
  // assertions, which is exactly what referential integrity must prevent.
  let first,
    last,
    salt = 0;
  do {
    first = pick(FIRST, `first:${k}:${salt}`);
    last = pick(LAST, `last:${k}:${salt}`, 4);
    salt += 1;
  } while (takenNames.has(`${first} ${last}`) && salt < 500);
  takenNames.add(`${first} ${last}`);

  const p = {
    firstName: first,
    lastName: last,
    displayName: `${first} ${last}`,
    email: `${first}.${last}@example.test`.toLowerCase(),
    image: `https://example.test/avatar/${digest(k).toString('hex').slice(0, 32)}.png`,
  };
  personas.set(k, p);
  return p;
}

// Derive the persona key for an object from whatever identity fields it has.
function personaKeyFor(obj) {
  const first = obj.firstName;
  const last = obj.lastName;
  if (typeof first === 'string' && first && typeof last === 'string' && last)
    return `${first} ${last}`;
  for (const k of ['displayName', 'dummyName', 'email', 'firstName', 'lastName']) {
    if (typeof obj[k] === 'string' && obj[k]) return obj[k];
  }
  return null;
}

// ------------------------------------------------------------------ ids

const ids = new Map();

function fakeUuid(orig) {
  if (ids.has(orig)) return ids.get(orig);
  const h = digest(`uuid:${orig}`).toString('hex');
  // Keep it a syntactically valid v4 uuid so any format validation still passes.
  const v = [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join('-');
  ids.set(orig, v);
  return v;
}

function fakeProviderId(orig) {
  if (ids.has(orig)) return ids.get(orig);
  const [scheme] = String(orig).split('|');
  const v = `${scheme}|${digest(`pid:${orig}`).toString('hex').slice(0, 24)}`;
  ids.set(orig, v);
  return v;
}

// --------------------------------------------------------------- scrubbing

// Unambiguous identifiers: emails, avatar URLs, uuids, Auth0 subject ids.
// None of these can legitimately occur in TMDB data, so verification can
// substring-search the whole output for them and any hit is a real leak.
const secrets = new Map();
const record = (from, to) => {
  if (typeof from === 'string' && from.trim() && from !== to) secrets.set(from, to);
};

// Name tokens for the free-text pass. Kept separate from `secrets` because
// they are matched on word boundaries inside prose only — never as bare
// substrings, and never outside FREETEXT_KEYS.
//
// A global substring replace was tried first and corrupted domain data:
// "Bill" inside "Billy Lynn's Long Halftime Walk", "Jack" inside "Jackie",
// and a user whose dummyName is "Indiana Jones" rewriting the movie title
// "Indiana Jones and the Dial of Destiny". Titles and cast names must survive
// untouched — contract tests depend on them.
const nameTokens = new Map();
const recordToken = (from, to) => {
  if (typeof from === 'string' && from.length > 2 && from !== to)
    nameTokens.set(from, to);
};

// The only app-generated prose in the fixtures. Every other long string
// (title, overview, character, original_name, tagline, job) is TMDB data.
const FREETEXT_KEYS = new Set(['message']);

function scrub(node) {
  if (Array.isArray(node)) return node.map(scrub);
  if (!node || typeof node !== 'object') return node;

  const out = {};
  const pKey = personaKeyFor(node);
  const p = pKey ? persona(pKey) : null;

  for (const [k, v] of Object.entries(node)) {
    if (v !== null && typeof v === 'object') {
      out[k] = scrub(v);
      continue;
    }

    if (PERSONA_KEYS.has(k) && typeof v === 'string' && v) {
      // dummyName is a stand-in for an unregistered participant — a person's
      // name in practice, so it maps onto the persona's display name.
      const field = k === 'dummyName' ? 'displayName' : k;
      // Fall back to a per-value persona for a stray field with no object context.
      const src = p ?? persona(v);
      const replacement = src[field] ?? persona(v)[field];
      // Emails and avatar URLs are unambiguous — verify them by substring.
      // Personal *names* are not: users share first names with actors, and
      // joke dummyNames ("Indiana Jones", "Jason Bourne") are literally movie
      // titles in this dataset. Those get word-bounded checks scoped to the
      // fields that describe people, never a blind search of TMDB content.
      if (k === 'email' || k === 'image') record(v, replacement);
      // Record name parts for the prose pass only.
      if (k === 'displayName' || k === 'dummyName') {
        const parts = v.split(/\s+/).filter((x) => x.length > 2);
        const repl = replacement.split(/\s+/);
        recordToken(v, replacement);
        parts.forEach((part, i) => {
          recordToken(part, repl[i] ?? repl[0]);
        });
      }
      if (k === 'firstName' || k === 'lastName') recordToken(v, replacement);
      out[k] = replacement;
      continue;
    }

    if (ID_KEYS.has(k) && typeof v === 'string' && v) {
      const replacement = k === 'providerId' ? fakeProviderId(v) : fakeUuid(v);
      record(v, replacement);
      out[k] = replacement;
      continue;
    }

    out[k] = v;
  }
  return out;
}

// ------------------------------------------------------------------- run

// Pass 1 — structural scrub, which also populates `secrets` and `nameTokens`.
const scrubbed = new Map();
for (const [f, doc] of raw) scrubbed.set(f, scrub(doc));

// Pass 2 — prose. Names appear inside `message` strings ("Jon drafted these
// movies in the 2024 Racso award league") that no field rule reaches.
// Longest-first so "Jon Bernard" is consumed before "Jon", and word-bounded so
// "Bill" cannot match inside "Billy".
const tokens = [...nameTokens.entries()].sort((a, b) => b[0].length - a[0].length);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function sweepProse(text) {
  let s = text;
  for (const [from, to] of tokens) {
    s = s.replace(
      new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(from)}(?![\\p{L}\\p{N}])`, 'giu'),
      to,
    );
  }
  return s;
}

function applyProse(node) {
  if (Array.isArray(node)) return node.map(applyProse);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (FREETEXT_KEYS.has(k) && typeof v === 'string') out[k] = sweepProse(v);
    else out[k] = v !== null && typeof v === 'object' ? applyProse(v) : v;
  }
  return out;
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

for (const [f, data] of scrubbed) {
  writeFileSync(join(DEST, f), `${JSON.stringify(applyProse(data), null, 2)}\n`);
}
// .path sidecars embed identifiers in the URL (/profile/feed/user/<uuid>), so
// copying them verbatim would leak. Only the id map applies here — these are
// exact, unambiguous strings, not prose.
for (const f of readdirSync(SRC).filter((x) => x.endsWith('.path'))) {
  let text = readFileSync(join(SRC, f), 'utf8');
  for (const [from, to] of ids) text = text.split(from).join(to);
  writeFileSync(join(DEST, f), text);
}

// Pass 3 — verify. A scrubber that silently misses something is worse than
// none at all, so this fails loudly rather than warning.
const failures = [];

// (a) No unambiguous identifier survived anywhere. Every emitted file, not
// just the .json — the .path sidecars carry uuids too.
for (const f of readdirSync(DEST)) {
  const text = readFileSync(join(DEST, f), 'utf8');
  for (const [orig] of secrets) {
    if (text.includes(orig)) failures.push(`${f}: leaked ${JSON.stringify(orig)}`);
  }
  for (const m of text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []) {
    if (!m.endsWith('@example.test')) failures.push(`${f}: real-looking email ${m}`);
  }
  if (text.includes('gravatar.com')) failures.push(`${f}: gravatar URL survived`);
  if (/auth0\|61e489/.test(text)) failures.push(`${f}: real Auth0 subject survived`);
}

// (b) No original personal name survived in a field that describes a person,
// nor in prose. Scoped to those fields on purpose: an actor in a TMDB cast
// list who happens to share a first name with a league member is public
// data, not a leak, and flagging it would make this check unusable.
const PERSON_FIELDS = new Set([...PERSONA_KEYS, ...FREETEXT_KEYS]);
const bounded = (needle) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(needle)}(?![\\p{L}\\p{N}])`, 'iu');

for (const f of files) {
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    for (const [k, v] of Object.entries(n)) {
      if (PERSON_FIELDS.has(k) && typeof v === 'string') {
        for (const [orig] of nameTokens) {
          if (bounded(orig).test(v))
            failures.push(`${f}: ${k} still contains ${JSON.stringify(orig)}`);
        }
      }
      walk(v);
    }
  };
  walk(JSON.parse(readFileSync(join(DEST, f), 'utf8')));
}

// (c) Nothing else changed. This is the half that matters for test value: an
// over-eager scrubber that rewrites movie titles still passes (a) while
// destroying the fixtures. Mask the fields we intend to change on both sides;
// everything remaining must be byte-identical to the raw capture.
const MASK = new Set([...PERSONA_KEYS, ...ID_KEYS, ...FREETEXT_KEYS]);
const mask = (n) => {
  if (Array.isArray(n)) return n.map(mask);
  if (n && typeof n === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(n)) o[k] = MASK.has(k) ? '<masked>' : mask(v);
    return o;
  }
  return n;
};
for (const f of files) {
  const raw = JSON.stringify(mask(JSON.parse(readFileSync(join(SRC, f), 'utf8'))));
  const done = JSON.stringify(mask(JSON.parse(readFileSync(join(DEST, f), 'utf8'))));
  if (raw !== done) failures.push(`${f}: scrub altered data outside the intended fields`);
}

if (failures.length) {
  console.error(`SCRUB FAILED\n${failures.map((x) => `  ${x}`).join('\n')}`);
  process.exit(1);
}

console.log(`Scrubbed ${files.length} fixtures → fixtures/`);
console.log(
  `  ${personas.size} personas, ${ids.size} identifiers, ${secrets.size} distinct values replaced`,
);
