// Prisma 7 moved CLI configuration out of the schema and into this file (D31).
//
// Two things changed from Prisma 6 that make this file mandatory rather than
// optional: `datasource.url` in schema.prisma is now a hard error (P1012), and
// the CLI no longer auto-loads .env — hence the explicit dotenv import.
//
// This is CLI-only configuration. The application reads DATABASE_URL through
// lib/db.ts and never imports this file.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // 🔴 The direct connection first, the pooled one last. Migrations take a
  // Postgres advisory lock and issue DDL, neither of which survives a PgBouncer
  // pool in transaction mode — which is exactly what Neon's `-pooler` host is.
  // The running app wants the pooled URL; the CLI wants the direct one. Where
  // only one is set (local Docker, a developer's shell) they are the same
  // string and the chain collapses to `DATABASE_URL`.
  //
  // 🔴 `DATABASE_URL_UNPOOLED` and `POSTGRES_URL_NON_POOLING` are **Neon's own
  // names**, injected into Preview and Production by the Marketplace
  // integration and re-issued by it whenever the password rotates or the branch
  // moves. Reading them is what makes this work on Vercel with nothing set by
  // hand: a `DIRECT_URL` copied out of the Neon console would be a second copy
  // of a rotating secret, correct on the day it was pasted and silently stale
  // afterwards. `DIRECT_URL` stays first so anyone who does set it deliberately
  // — a different database, a one-off migration target — still wins.
  datasource: {
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DATABASE_URL,
  },
});
