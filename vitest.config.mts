import { existsSync, globSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const root = import.meta.dirname;

/** Vitest's own default `include`, so this walk sees exactly the files it runs. */
const TEST_GLOB = '**/*.{test,spec}.?(c|m)[jt]s?(x)';

export const EXCLUDE = [
  'node_modules',
  '.next',
  // e2e/ holds Playwright specs, which Playwright runs. Without this exclusion
  // Vitest picks them up and fails on Playwright's globals.
  'e2e',
];

const DB_CLIENT = resolve(root, 'lib/db.ts');
const IMPORT = /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/g;
const TYPE_ONLY = /\b(?:import|export)\s+type\s[\s\S]*?from\s*['"]([^'"]+)['"]/g;
const MOCK_WITH_FACTORY = /\bvi\.(?:mock|doMock)\(\s*['"]([^'"]+)['"]\s*,/g;

/** First-party specifiers only — a bare package name can never reach `lib/db`. */
function resolveSpecifier(specifier: string, from: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = resolve(root, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
  else return null;

  const extensions = [
    '',
    '.ts',
    '.tsx',
    '.mts',
    '.mjs',
    '.js',
    '/index.ts',
    '/index.tsx',
  ];
  for (const extension of extensions) {
    const candidate = base + extension;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function valueImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  // `import type` is erased before the module ever runs, so it reaches nothing.
  const typeOnly = new Set([...source.matchAll(TYPE_ONLY)].map((m) => m[1]));
  const out: string[] = [];
  for (const match of source.matchAll(IMPORT)) {
    const specifier = match[1] ?? match[2];
    if (typeOnly.has(specifier)) continue;
    const resolved = resolveSpecifier(specifier, file);
    if (resolved) out.push(resolved);
  }
  return out;
}

/** Modules the test replaces outright, so the real one — and its imports — never load. */
function mockedModules(testFile: string): Set<string> {
  const source = readFileSync(testFile, 'utf8');
  // A factory that calls `importOriginal`/`importActual` loads the real module
  // after all, and with it everything the real module imports. Rather than
  // work out which mock in the file is the partial one, trust none of them.
  if (/import(?:Original|Actual)/.test(source)) return new Set();
  return new Set(
    [...source.matchAll(MOCK_WITH_FACTORY)]
      .map((m) => resolveSpecifier(m[1], testFile))
      .filter((m): m is string => m !== null),
  );
}

/** Does anything this test actually loads import the Prisma client? */
function reachesDbClient(testFile: string): boolean {
  const seen = mockedModules(testFile);
  const queue = [testFile];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (file === DB_CLIENT) return true;
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...valueImports(file));
  }
  return false;
}

/**
 * 🔴 The allowlist is computed, and the *serial* project is the default.
 *
 * Grepping test files for `@/lib/db` is the obvious classification and it is
 * wrong twice over: it misses the relative spelling (`./db`, in db.test.ts and
 * schema.test.ts), and it misses every test that reaches Postgres through
 * something else — a page importing `lib/auth`, a component importing a
 * service, a service importing a repository. Ten files here are DB-backed for
 * one of those two reasons, and a grep calls all ten safe. So this walks the
 * import graph instead, from each test file down through the first-party
 * imports it actually loads, and asks whether the Prisma client is in it.
 *
 * Only files proven unreachable get into the parallel project. Everything else
 * — including any test file added tomorrow, and any existing one that grows an
 * import reaching a repository — falls through to the serial project without
 * anyone having to remember a naming convention or edit a list.
 */
const dbFreeTests = globSync(TEST_GLOB, {
  cwd: root,
  exclude: (path) => EXCLUDE.some((dir) => path === dir || path.startsWith(`${dir}/`)),
})
  .map((file) => relative(root, resolve(root, file)))
  .filter((file) => !reachesDbClient(resolve(root, file)))
  .sort();

/**
 * The whole config, parameterised by what to leave out — `vitest.ci.config.mts`
 * passes a longer list. It is a factory rather than something `mergeConfig` can
 * extend because the exclusions have to reach *inside* both projects: a root
 * `exclude` merged over a config that already has `projects` changes nothing
 * about which files those projects collect.
 */
export const config = (exclude: string[]) =>
  defineConfig({
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      exclude,
      projects: [
        {
          extends: true as const,
          test: {
            name: 'parallel',
            include: dbFreeTests,
            exclude,
            /**
             * 🔴 Nothing is listening on 5599 — that is the point.
             *
             * The classification above is static, so it can only ever be as good as
             * its reading of the import graph. This makes a mistake loud: a test in
             * here that actually talks to Postgres fails on connect, immediately and
             * every time, instead of quietly racing the invariant below and failing
             * one run in three on CI. A file that imports the client without ever
             * querying still passes, which is correct — it cannot race anything.
             */
            env: {
              DATABASE_URL: 'postgresql://cinemadraft:local@localhost:5599/cinemadraft',
            },
          },
        },
        {
          extends: true as const,
          test: {
            name: 'db',
            exclude: [...exclude, ...dbFreeTests],

            // One test file at a time. Vitest runs files in parallel by default, and
            // these tests share a single Postgres database — not a fixture each worker
            // can hold its own copy of.
            //
            // The active season is the sharpest case. `available_years_one_active` is
            // a partial unique index, so exactly one row in the entire database may be
            // active; there is no per-worker version of it to isolate. While
            // available-years.test.ts had 2025 temporarily active, schema.test.ts was
            // concurrently asserting that 2026 was active and that flagging 2025 would
            // be rejected. Both failed, in roughly one run out of three.
            //
            // Serializing is the fix rather than a workaround: the invariant under
            // test is global by design, so a test that moves it cannot be isolated,
            // only sequenced. What changed since is only *which* files pay for it:
            // the two-thirds of the suite that never open a connection now run in
            // parallel beside this one, which is where the wall time went.
            fileParallelism: false,
          },
        },
      ],
    },
    resolve: {
      alias: { '@': root },
    },
  });

export default config(EXCLUDE);
