import type { Metadata } from 'next';

import { addFilmToList } from '@/actions/draft-list/add-film';
import { removeFilmFromList } from '@/actions/draft-list/remove-film';
import { reorderList } from '@/actions/draft-list/reorder-list';
import { setListStatus } from '@/actions/draft-list/set-status';
import { findFilmsAction } from '@/actions/search/find-films';
import { DraftListEditor, type DraftListStatus } from '@/components/DraftListEditor';
import { Panel } from '@/components/Panel';
import { SectionHead } from '@/components/SectionHead';
import { requireUser } from '@/lib/auth';
import { getDraftList } from '@/lib/services/draft-list';
import { getActiveYear } from '@/lib/services/season';

/**
 * A member's private ranked pre-draft list (P10.T20).
 *
 * The one surface in the app that is only about preparation: nobody else sees
 * it, nothing on it scores, and people keep one for weeks before a draft. That
 * is also why it shows no points — there is nothing to be right or wrong about
 * yet, and a number here would invite reading the list as a prediction rather
 * than an intention.
 *
 * Private, and not listed in `proxy.ts` — everything under `(app)` needs a
 * session unless it is deliberately public (D44).
 */

export const metadata: Metadata = {
  title: 'Draft list',
  description: 'Your private ranked shortlist for the next draft.',
};

export default async function DraftListPage() {
  const user = await requireUser();
  const year = await getActiveYear();
  const entries = await getDraftList(user.id, year);

  const marked = entries.filter((entry) => entry.status !== 'none').length;
  const remaining = entries.length - marked;

  return (
    <>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
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

        <Panel className="p-4 sm:p-6">
          <DraftListEditor
            entries={entries.map((entry) => ({
              entryId: entry.entryId,
              movieId: entry.movieId,
              title: entry.title,
              posterUrl: entry.posterUrl,
              releaseYear: entry.releaseYear,
              status: entry.status,
            }))}
            // The search is bound to the season, so a film eligible this year
            // ranks above one that is not (§10). An inline Server Action rather
            // than a prop on the component, because the year is server data and
            // the editor must stay injectable for its tests.
            // biome-ignore lint/performance/noJsxPropsBind: a Server Action in a Server Component — this compiles to a stable action reference, not a client closure rebuilt on render
            onSearch={async (query: string) => {
              'use server';
              return findFilmsAction({
                query,
                context: { kind: 'draft', year, takenMovieIds: [] },
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
        </Panel>
      </div>
    </>
  );
}
