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
  datasource: { url: process.env.DATABASE_URL },
});
