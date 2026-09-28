'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { openSeason } from '@/actions/leagues/manage-league';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Panel } from '@/components/ui/Panel';
import { SectionHead } from '@/components/ui/SectionHead';
import { leagueHref } from '@/lib/utils/league-href';

/**
 * Opening the next season (D131): "Open 2027" on the league page's Seasons
 * nav, and the same act as a panel in place of the board when the owner is
 * looking at the season that could be opened.
 *
 * 🔴 **It starts empty.** Nobody carries forward; the owner adds people from
 * earlier seasons on the setup page, one tap each, which is where this lands.
 * Both shapes confirm first, because the act changes what the league page
 * shows everyone.
 *
 * `action` exists for Storybook, which cannot call a Server Action; the app
 * never passes it.
 */
type Open = typeof openSeason;

function useOpen(leagueId: number, year: number, action: Open) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    const yes = await confirm(
      `Open ${year}? It starts empty. You'll add people on the next page. ${year - 1} stays exactly as it is.`,
      `Open ${year}`,
    );
    if (!yes) return;
    startTransition(async () => {
      setError(null);
      const result = await action({ leagueId, year });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/leagues/${leagueId}/setup?year=${year}`);
    });
  };

  // Always in the DOM, so a screen reader hears a failure the moment it lands.
  const status = (
    <p aria-live="polite" className="text-text-secondary min-h-5 text-sm">
      {pending ? 'Opening…' : (error ?? '')}
    </p>
  );

  return { open, pending, dialog, status };
}

/** The Seasons nav's last entry, for the owner only. */
export function OpenSeasonButton({
  leagueId,
  year,
  action = openSeason,
}: {
  leagueId: number;
  year: number;
  action?: Open;
}) {
  const { open, pending, dialog, status } = useOpen(leagueId, year, action);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outlined" onClick={open} disabled={pending} sx={{ minHeight: 44 }}>
        + Open {year}
      </Button>
      {status}
      {dialog}
    </div>
  );
}

/** In place of the board, when the owner is looking at the season that could be opened. */
export function OpenSeasonPanel({
  leagueId,
  year,
  fromYear,
  action = openSeason,
}: {
  leagueId: number;
  year: number;
  fromYear: number;
  action?: Open;
}) {
  const { open, pending, dialog, status } = useOpen(leagueId, year, action);

  return (
    <Panel as="section" className="flex max-w-3xl flex-col gap-5 p-6">
      <SectionHead as="h2" eyebrow={`${year} season`}>
        Open the {year} season
      </SectionHead>

      <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
        The site has moved on to {year}. Opening it gives the league an empty season: on
        the next page you add people from earlier seasons, one tap each, and group them
        before the draft. The {fromYear} board and standings stay exactly as they are.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={open} disabled={pending} sx={{ minHeight: 44 }}>
          Open {year}
        </Button>
        <Link
          href={leagueHref(leagueId, { year: fromYear })}
          className="text-text-secondary hover:text-text-primary flex min-h-11 items-center text-sm underline"
        >
          See {fromYear}
        </Link>
      </div>

      {status}
      {dialog}
    </Panel>
  );
}
