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
  // 🔴 `DIRECT_URL` first, `DATABASE_URL` second. Migrations take a Postgres
  // advisory lock and issue DDL, neither of which survives a PgBouncer pool in
  // transaction mode — which is exactly what Neon's `-pooler` host is. The
  // running app wants the pooled URL; the CLI wants the direct one. Where only
  // one is set (local Docker, a developer's shell) this is the same string.
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
});
