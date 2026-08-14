import { describe, expect, it } from 'vitest';

import { camel, enumName, pascalSingular, transform } from './pascalize-schema.mjs';

describe('camel', () => {
  it('converts snake_case to camelCase', () => {
    expect(camel('created_at')).toBe('createdAt');
    expect(camel('requires_nominee_name')).toBe('requiresNomineeName');
    expect(camel('detail_character')).toBe('detailCharacter');
  });

  it('keeps acronym-ish segments intact', () => {
    // The inverse of the snake transform: tmdb_id came from tmdbId, so it must
    // round-trip back rather than becoming tmdbID or tmdb_id.
    expect(camel('tmdb_id')).toBe('tmdbId');
    expect(camel('imdb_id')).toBe('imdbId');
    expect(camel('fb_id')).toBe('fbId');
    expect(camel('user_uuid')).toBe('userUuid');
  });

  it('leaves single words alone', () => {
    expect(camel('order')).toBe('order');
    expect(camel('uuid')).toBe('uuid');
    expect(camel('year')).toBe('year');
  });
});

describe('pascalSingular', () => {
  it('singularises and pascalises table names', () => {
    expect(pascalSingular('available_years')).toBe('AvailableYear');
    expect(pascalSingular('draft_picks')).toBe('DraftPick');
    expect(pascalSingular('profile_feeds')).toBe('ProfileFeed');
    expect(pascalSingular('movies')).toBe('Movie');
    expect(pascalSingular('watchlists')).toBe('Watchlist');
    expect(pascalSingular('lists')).toBe('List');
    expect(pascalSingular('points')).toBe('Point');
    expect(pascalSingular('nominations')).toBe('Nomination');
  });

  it('does not apply the ies -> y rule', () => {
    // "movies" must become "Movie", not "Movy". A naive ies->y rule, which is
    // correct for "categories" -> "category", is wrong for every plural in
    // this schema.
    expect(pascalSingular('movies')).toBe('Movie');
  });

  it('leaves words ending in double-s alone', () => {
    expect(pascalSingular('address')).toBe('Address');
  });
});

describe('enumName', () => {
  it('drops the enum_ prefix and singularises the table part', () => {
    expect(enumName('enum_leagues_drafting_status')).toBe('LeagueDraftingStatus');
    expect(enumName('enum_leagues_type')).toBe('LeagueType');
    expect(enumName('enum_lists_status')).toBe('ListStatus');
    expect(enumName('enum_users_role')).toBe('UserRole');
  });
});

describe('transform', () => {
  const input = `model available_years {
  id         Int       @id @default(autoincrement())
  year       Int?      @unique
  created_at DateTime? @db.Timestamptz(6)
}

model leagues {
  id              Int                           @id @default(autoincrement())
  drafting_status enum_leagues_drafting_status?
  active_year     Int?

  @@index([active_year], map: "leagues_active_year")
}

enum enum_leagues_drafting_status {
  pending
  active
}
`;

  const output = transform(input);

  it('renames the model and maps it back to the table', () => {
    expect(output).toContain('model AvailableYear {');
    expect(output).toContain('@@map("available_years")');
  });

  it('renames fields and maps them back to the columns', () => {
    expect(output).toMatch(/createdAt\s+DateTime\?.*@map\("created_at"\)/);
  });

  it('does not add @map to fields whose name did not change', () => {
    const idLine = output.split('\n').find((l) => l.trim().startsWith('id '));
    expect(idLine).not.toContain('@map');
  });

  it('renames enum declarations and their references', () => {
    expect(output).toContain('enum LeagueDraftingStatus {');
    expect(output).toContain('@@map("enum_leagues_drafting_status")');
    expect(output).toMatch(/draftingStatus\s+LeagueDraftingStatus\?/);
  });

  it('rewrites field references inside @@index', () => {
    expect(output).toContain('@@index([activeYear], map: "leagues_active_year")');
  });

  it('preserves attributes it does not own', () => {
    expect(output).toContain('@id @default(autoincrement())');
    expect(output).toContain('@db.Timestamptz(6)');
    expect(output).toContain('@unique');
  });

  it('leaves enum values untouched', () => {
    // Values are already lowercase in the database. Renaming them would mean a
    // @map per value for no benefit. The enum block still gains its own @@map,
    // so this asserts the values rather than the shape of the whole block.
    const body = output.slice(output.indexOf('enum LeagueDraftingStatus'));
    expect(body).toContain('\n  pending\n');
    expect(body).toContain('\n  active\n');
    expect(body).not.toContain('PENDING');
  });
});
