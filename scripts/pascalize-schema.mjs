#!/usr/bin/env node
// Rewrite an introspected schema so Prisma models are PascalCase singular and
// fields camelCase, mapped back to the snake_case database (D27).
//
//   node scripts/pascalize-schema.mjs [path-to-schema]
//
// `prisma db pull` names models after tables, so a snake_case database yields
// `available_years` as a model and `created_at` as a field. We want idiomatic
// TypeScript over idiomatic SQL: `user.providerId` in code, `users.provider_id`
// in the database.
//
// This is the inverse of scripts/generate-normalize-sql.mjs, applied to 16
// models and ~140 fields. Scripted for the same reason that one was: doing it
// by hand invites exactly one silent typo, and a wrong @map points a working
// query at a column that does not exist.
//
// Prisma PRESERVES @@map/@map across re-introspection, so this cost is paid
// once — provided nobody runs `prisma db pull --force`, which discards them.

import { readFileSync, writeFileSync } from 'node:fs';

/** snake_case -> camelCase. The inverse of the transform used to normalize. */
export const camel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

/** snake_case -> PascalCase, no singularisation. */
const pascal = (s) => {
  const c = camel(s);
  return c.charAt(0).toUpperCase() + c.slice(1);
};

/**
 * Strip one trailing plural `s`.
 *
 * Deliberately NOT the usual `ies -> y` rule: it is right for
 * "categories" -> "category" and wrong for "movies", which must singularise to
 * "movie". Every plural in this schema is a plain trailing `s`, so the naive
 * rule is the correct one here — and a wrong model name is loud (it fails to
 * compile) rather than silent.
 */
const singular = (s) => (s.endsWith('ss') || !s.endsWith('s') ? s : s.slice(0, -1));

/** Table name -> Prisma model name. `draft_picks` -> `DraftPick`. */
export const pascalSingular = (table) => {
  const parts = table.split('_');
  parts[parts.length - 1] = singular(parts[parts.length - 1]);
  return pascal(parts.join('_'));
};

/**
 * Enum type name -> Prisma enum name.
 * `enum_leagues_drafting_status` -> `LeagueDraftingStatus`.
 */
export const enumName = (name) => {
  const parts = name.replace(/^enum_/, '').split('_');
  parts[0] = singular(parts[0]);
  return pascal(parts.join('_'));
};

export function transform(schema) {
  // Pass 1 — collect every name that will change, so references can be
  // rewritten even when the declaration appears later in the file.
  const models = new Map(); // table -> Model
  const enums = new Map(); // enum_type -> EnumName

  for (const [, table] of schema.matchAll(/^model\s+(\w+)\s*\{/gm)) {
    models.set(table, pascalSingular(table));
  }
  for (const [, name] of schema.matchAll(/^enum\s+(\w+)\s*\{/gm)) {
    enums.set(name, enumName(name));
  }

  const lines = schema.split('\n');
  const out = [];

  let block = null; // 'model' | 'enum' | null
  let blockOriginal = null;

  for (const line of lines) {
    const modelStart = line.match(/^model\s+(\w+)\s*\{/);
    if (modelStart) {
      block = 'model';
      blockOriginal = modelStart[1];
      out.push(`model ${models.get(blockOriginal)} {`);
      continue;
    }

    const enumStart = line.match(/^enum\s+(\w+)\s*\{/);
    if (enumStart) {
      block = 'enum';
      blockOriginal = enumStart[1];
      out.push(`enum ${enums.get(blockOriginal)} {`);
      continue;
    }

    if (line.startsWith('}')) {
      // Close the block, adding the mapping back to the database name.
      if (block === 'model') out.push(`\n  @@map("${blockOriginal}")`);
      if (block === 'enum') out.push(`\n  @@map("${blockOriginal}")`);
      out.push(line);
      block = null;
      blockOriginal = null;
      continue;
    }

    // Enum values are already lowercase in the database and are left alone —
    // renaming them would require a @map per value for no benefit.
    if (block === 'enum') {
      out.push(line);
      continue;
    }

    if (block === 'model') {
      // Block-level attributes: rewrite the field names inside them.
      const blockAttr = line.match(/^\s*@@(index|unique|id)\(\[([^\]]+)\]/);
      if (blockAttr) {
        const rewritten = blockAttr[2]
          .split(',')
          .map((f) => camel(f.trim()))
          .join(', ');
        out.push(line.replace(/\[([^\]]+)\]/, `[${rewritten}]`));
        continue;
      }

      // Field lines: `  created_at DateTime? @db.Timestamptz(6)`
      const field = line.match(/^(\s+)([a-z_][a-z0-9_]*)(\s+)(\S+)(.*)$/);
      if (field) {
        const [, indent, name, gap, type, rest] = field;
        const newName = camel(name);

        // Rewrite the type if it is an enum or a relation to another model.
        const bareType = type.replace(/[?[\]]/g, '');
        const suffix = type.slice(bareType.length);
        const newType = enums.get(bareType) ?? models.get(bareType) ?? bareType;

        // Only add @map where the name actually changed. Adding it everywhere
        // would be noise on `id`, `year`, `uuid` and friends.
        const mapAttr = newName === name ? '' : ` @map("${name}")`;

        out.push(`${indent}${newName}${gap}${newType}${suffix}${rest}${mapAttr}`);
        continue;
      }
    }

    out.push(line);
  }

  return out.join('\n');
}

// --- CLI ---------------------------------------------------------------
// Guarded so the test file can import the pure functions without side effects.
if (process.argv[1]?.endsWith('pascalize-schema.mjs')) {
  const path = process.argv[2] ?? 'prisma/schema.prisma';
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  writeFileSync(path, after);

  const models = (after.match(/^model /gm) ?? []).length;
  const maps = (after.match(/@map\(/g) ?? []).length;
  console.log(`${path}: ${models} models, ${maps} mappings written`);
}
