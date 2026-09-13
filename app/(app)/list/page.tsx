import type { Metadata } from 'next';

import { addFilmToList } from '@/actions/draft-list/add-film';
import { removeFilmFromList } from '@/actions/draft-list/remove-film';
import { reorderList } from '@/actions/draft-list/reorder-list';
import { setListStatus } from '@/actions/draft-list/set-status';
import { findFilmsAction } from '@/actions/search/find-films';
import {
  DraftListEditor,
  type DraftListStatus,
} from '@/components/draft/DraftListEditor';
import { SectionHead } from '@/components/ui/SectionHead';
import { requireUser } from '@/lib/auth';
import { NOINDEX } from '@/lib/seo';
import { getDraftList } from '@/lib/services/draft-list';
import { getActiveYear } from '@/lib/services/season';

export const metadata: Metadata = {
  // One member's private page. Public routes are the proxy's call (D44); this
  // only keeps the page out of search results.
  robots: NOINDEX,
  title: 'Draft list',
  description: 'Your private ranked shortlist for the next draft.',
};

export default async function DraftListPage() {
  const user = await requireUser();
  const year = await getActiveYear();
  const entries = await getDraftList(user.id, year);

  const marked = entries.filter((entry) => entry.status !== 'none').length;
  const remaining = entries.length - marked;
  const onList = entries.flatMap((entry) =>
    entry.movieId == null ? [] : [entry.movieId],
  );

  return (
    <>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
        <SectionHead
          as="h1"
          eyebrow={`${year} season · only you can see this`}
          right={entries.length === 0 ? undefined : String(entries.length)}
        >
          Draft list
        </SectionHead>

        {/* Only once something has been marked: before a draft starts, "12 of
            12 still on the board" is a sentence about nothing. */}
        {marked > 0 ? (
          <p className="text-text-secondary text-sm">
            <span className="tabular font-mono">{remaining}</span> of{' '}
            <span className="tabular font-mono">{entries.length}</span> still on the
            board.
          </p>
        ) : null}

        {/* 🔴 No `Panel` here (P17.T36). AppShell already renders the page's
            content in `Panel as="main"` at the same `panel` tone, so a second
            one is invisible and contributes only a 24px gutter — which is what
            put this page's heading, search field and empty state on three
            different left edges (445 / 469 / 493 at 1440px). A Panel around a
            list *item* is a card; a Panel around the whole page body is a
            duplicate column. */}
        <DraftListEditor
          entries={entries.map((entry) => ({
            entryId: entry.entryId,
            movieId: entry.movieId,
            title: entry.title,
            posterUrl: entry.posterUrl,
            releaseYear: entry.releaseYear,
            status: entry.status,
          }))}
          // biome-ignore lint/performance/noJsxPropsBind: a Server Action in a Server Component — this compiles to a stable action reference, not a client closure rebuilt on render
          onSearch={async (query: string) => {
            'use server';
            return findFilmsAction({
              query,
              context: { kind: 'draft', year, takenMovieIds: onList },
            });
          }}
          // biome-ignore lint/performance/noJsxPropsBind: as above
          onAdd={async (film: { movieId?: number; tmdbId?: string }) => {
            'use server';
            return addFilmToList({ year, ...film });
          }}
          // biome-ignore lint/performance/noJsxPropsBind: as above
          onRemove={async (entryId: number) => {
            'use server';
            return removeFilmFromList({ entryId });
          }}
          // biome-ignore lint/performance/noJsxPropsBind: as above
          onSetStatus={async (entryId: number, status: DraftListStatus) => {
            'use server';
            return setListStatus({ entryId, status });
          }}
          // biome-ignore lint/performance/noJsxPropsBind: as above
          onReorder={async (entryIds: number[]) => {
            'use server';
            return reorderList({ year, entryIds });
          }}
        />
      </div>
    </>
  );
}
