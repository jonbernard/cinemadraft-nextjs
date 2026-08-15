import { describe, expect, it } from 'vitest';

import {
  type Candidate,
  mergeCandidates,
  rankCandidates,
  type SearchContext,
} from './search-ranking';

/**
 * §10's table is the specification, so each row of it is a test here.
 *
 * This is the only interesting logic in the search path and it needs no
 * database, which is why it is written first — the query and the network are
 * plumbing around this function.
 */
let nextId = 1;

function film(title: string, over: Partial<Candidate> = {}): Candidate {
  const id = over.id === null ? null : (over.id ?? nextId++);
  return {
    id,
    tmdbId: over.tmdbId ?? (id == null ? null : `tmdb-${id}`),
    title,
    releaseYear: over.releaseYear ?? null,
    isLocal: over.isLocal ?? true,
    nominatedYears: over.nominatedYears ?? [],
  };
}

/** A film TMDB knows and this app has never ingested. */
function remote(title: string, over: Partial<Candidate> = {}): Candidate {
  return film(title, {
    ...over,
    id: null,
    isLocal: false,
    tmdbId: over.tmdbId ?? 'tmdb-x',
  });
}

const browse: SearchContext = { kind: 'browse' };
const admin2026: SearchContext = { kind: 'award-admin', year: 2026 };
const titles = (candidates: readonly Candidate[]) => candidates.map((c) => c.title);

describe('rankCandidates — relevance', () => {
  it('🔴 ranks an exact title above a prefix match', () => {
    // Someone who typed a whole title has told you exactly what they want.
    const ranked = rankCandidates('dune', [film('Dune: Part Two'), film('Dune')], browse);

    expect(titles(ranked)[0]).toBe('Dune');
  });

  it('ranks a prefix above a mid-title word match', () => {
    const ranked = rankCandidates(
      'battle',
      [film('One Battle After Another'), film('Battleship Potemkin')],
      browse,
    );

    expect(titles(ranked)[0]).toBe('Battleship Potemkin');
  });

  it('🔴 finds a film by a word that is not its first', () => {
    // The owner is repeating a title they heard out loud, and people rarely
    // start at the first word.
    const ranked = rankCandidates(
      'battle',
      [film('Unrelated Film'), film('One Battle After Another')],
      browse,
    );

    expect(titles(ranked)[0]).toBe('One Battle After Another');
  });

  it('is case- and whitespace-insensitive', () => {
    const ranked = rankCandidates('  DUNE ', [film('Nope'), film('Dune')], browse);

    expect(titles(ranked)[0]).toBe('Dune');
  });
});

describe('rankCandidates — local rows win', () => {
  it('🔴 ranks a film already in the database above a TMDB-only result', () => {
    // The local row is the one that can be drafted, nominated and scored. A
    // TMDB duplicate above it would offer the copy that does nothing.
    const ranked = rankCandidates('dune', [remote('Dune'), film('Dune')], browse);

    expect(ranked[0]?.isLocal).toBe(true);
  });

  it('still lets an exact TMDB match beat a local near-miss', () => {
    // Being local is worth a lot, but not more than being the film asked for.
    const ranked = rankCandidates(
      'dune',
      [film('Dune: Part Two'), remote('Dune')],
      browse,
    );

    expect(titles(ranked)[0]).toBe('Dune');
  });
});

describe('rankCandidates — the award year', () => {
  it('boosts a film nominated in the context year', () => {
    const ranked = rankCandidates(
      'the',
      [film('The Other'), film('The One', { nominatedYears: [2026] })],
      admin2026,
    );

    expect(titles(ranked)[0]).toBe('The One');
  });

  it('boosts a film released in the context year', () => {
    const ranked = rankCandidates(
      'the',
      [film('The Other', { releaseYear: 2019 }), film('The One', { releaseYear: 2026 })],
      admin2026,
    );

    expect(titles(ranked)[0]).toBe('The One');
  });

  it('ignores the year entirely when browsing', () => {
    // Browse is "find any film"; a 1925 film is not less relevant there.
    const ranked = rankCandidates(
      'potemkin',
      [film('Battleship Potemkin', { releaseYear: 1925 })],
      browse,
    );

    expect(titles(ranked)).toEqual(['Battleship Potemkin']);
  });
});

describe('rankCandidates — a draft in progress', () => {
  const draft = (taken: number[]): SearchContext => ({
    kind: 'draft',
    year: 2026,
    takenMovieIds: taken,
  });

  it('🔴 sinks a film already taken in the league', () => {
    const gone = film('Dune', { id: 7 });
    const available = film('Dune: Part Two', { id: 8 });

    const ranked = rankCandidates('dune', [gone, available], draft([7]));

    expect(titles(ranked)[0]).toBe('Dune: Part Two');
  });

  it('🔴 never removes it', () => {
    // Ranking orders, it does not filter. A film that vanished would read as
    // "not in the system" and send the owner hunting for it mid-call — the UI
    // marks it Taken instead, and cannot do that with a film it never sees.
    const gone = film('Dune', { id: 7 });

    const ranked = rankCandidates('dune', [gone], draft([7]));

    expect(titles(ranked)).toEqual(['Dune']);
  });

  it('🔴 keeps a taken film above an irrelevant available one', () => {
    // The rule is "below an equally relevant available film", not "below
    // everything". The owner typed a title because someone said it out loud:
    // if that film is gone, the most useful answer on screen is that film,
    // marked Taken. Burying it under an unrelated title that happens to be
    // available answers a question nobody asked, and the owner would go on
    // hunting for the one they were told about.
    const gone = film('Dune', { id: 7 });
    const irrelevant = film('Something Else', { id: 9 });

    const ranked = rankCandidates('dune', [gone, irrelevant], draft([7]));

    expect(titles(ranked)[0]).toBe('Dune');
  });

  it('does not sink a TMDB-only film, which cannot have been taken', () => {
    const ranked = rankCandidates('dune', [remote('Dune')], draft([7]));

    expect(titles(ranked)).toEqual(['Dune']);
  });
});

describe('rankCandidates — stability', () => {
  it('🔴 is stable for equally-scored candidates', () => {
    // The owner is aiming at a row. Two equally-scored films that swapped
    // places between keystrokes would move the target under the cursor.
    const twice = () =>
      titles(
        rankCandidates('a', [film('A Two', { id: 2 }), film('A One', { id: 1 })], browse),
      );

    expect(twice()).toEqual(twice());
    expect(twice()).toEqual(['A One', 'A Two']);
  });

  it('returns every candidate it was given, always', () => {
    const given = [film('One'), film('Two'), remote('Three')];

    expect(rankCandidates('zzz', given, browse)).toHaveLength(3);
  });

  it('handles an empty list', () => {
    expect(rankCandidates('dune', [], browse)).toEqual([]);
  });
});

describe('mergeCandidates', () => {
  it('🔴 never lets a film appear twice', () => {
    const local = [film('Dune', { tmdbId: '438631' })];
    const fromTmdb = [remote('Dune', { tmdbId: '438631' })];

    const merged = mergeCandidates(local, fromTmdb);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.isLocal).toBe(true);
  });

  it('keeps a TMDB film the app has never ingested', () => {
    const merged = mergeCandidates(
      [film('Dune', { tmdbId: '438631' })],
      [remote('Nosferatu', { tmdbId: '426063' })],
    );

    expect(titles(merged).sort()).toEqual(['Dune', 'Nosferatu']);
  });

  it('drops a duplicate within the remote list too', () => {
    const merged = mergeCandidates(
      [],
      [remote('Dune', { tmdbId: '438631' }), remote('Dune', { tmdbId: '438631' })],
    );

    expect(merged).toHaveLength(1);
  });

  it('keeps films with no tmdbId rather than collapsing them together', () => {
    // A film added by hand has no TMDB id. Two of them are two films, not one
    // duplicated — treating a null as a matching key would silently delete one.
    const merged = mergeCandidates(
      [
        film('Hand Added One', { tmdbId: null }),
        film('Hand Added Two', { tmdbId: null }),
      ],
      [],
    );

    expect(merged).toHaveLength(2);
  });
});
