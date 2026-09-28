'use client';

import { useEffect, useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHead } from '@/components/ui/SectionHead';
import type { StandingsView } from '@/lib/services/season-ledger';
import { showDay, showWeekday } from '@/lib/utils/season-words';
import { StandingsByShow } from './StandingsByShow';
import { WhatMoved } from './WhatMoved';

/**
 * The standings tab, kept live by one `EventSource` while a ceremony is being
 * entered (P16.T20, D135).
 *
 * 🔴 **A copy of `LeagueBoardRoom`'s effect, with `onAir` read as
 * `isDrafting`**, and nothing else changed; that file carries the reasoning.
 * The server render is the page; every frame is the complete view and
 * replaces this one; and the stop conditions are the feature, each with its
 * own test in `StandingsRoom.test.tsx`:
 *
 *   1. **Off air, no connection at all**, read from the server's own frame.
 *   2. **Hidden tab, no connection**, at mount too (D111).
 *   3. **Unmount closes it.**
 *   4. **A refusal is final** (`CLOSED`), a clean close is not (`CONNECTING`).
 *   5. **A frame saying the show is off air closes it.**
 */
export function StandingsRoom({
  initial,
  streamUrl,
}: {
  initial: StandingsView;
  /** Built by the page from its own season, so the stream renders what the first paint showed. */
  streamUrl: string;
}) {
  const [view, setView] = useState(initial);

  useEffect(() => {
    if (!initial.onAir) return;

    let source: EventSource | null = null;
    let done = false;

    const close = () => {
      source?.close();
      source = null;
    };

    const open = () => {
      if (done || source !== null || document.hidden) return;
      const opened = new EventSource(streamUrl);
      source = opened;

      opened.onmessage = (event) => {
        const next = JSON.parse(event.data) as StandingsView;
        setView(next);
        // The show going off air mid-stream arrives as one last full frame.
        if (!next.onAir) {
          done = true;
          close();
        }
      };

      opened.onerror = () => {
        if (opened.readyState === EventSource.CLOSED) {
          done = true;
          close();
        }
      };
    };

    const visibility = () => {
      if (document.hidden) close();
      else open();
    };

    open();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      close();
    };
  }, [streamUrl, initial.onAir]);

  if (!view.whatMoved)
    return (
      <EmptyState title="Nothing has scored yet">
        {view.firstDate == null
          ? 'The standings fill in from the season’s first nominations.'
          : `Nominations start ${showWeekday(view.firstDate)} ${showDay(view.firstDate)}.`}
      </EmptyState>
    );

  return (
    <>
      <WhatMoved moved={view.whatMoved} year={view.year} />
      <section className="flex flex-col gap-3">
        <SectionHead as="h2" eyebrow="Every show this season">
          Standings
        </SectionHead>
        <StandingsByShow rows={view.rows} shows={view.shows} />
      </section>
    </>
  );
}
