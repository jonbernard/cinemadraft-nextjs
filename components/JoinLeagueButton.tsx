'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import { joinLeague } from '@/actions/leagues/join-league';

/**
 * Accepting an invite.
 *
 * 🔴 **Joining is an act, not a page load.** The first version joined during
 * the render of `/join/[uuid]`, which Next rejects outright — a render must
 * not mutate — and which would also have meant that anything *fetching* the
 * link joined the league: a Slack or iMessage unfurl, a crawler, a prefetch.
 * The person pasting an invite into a group chat would have seated themselves
 * twice over before anyone clicked it.
 *
 * So the invite page names the league and waits. One button, one outcome.
 */
export function JoinLeagueButton({ uuid }: { uuid: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const join = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await joinLeague(uuid);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/leagues/${result.data.leagueId}`);
    });
  }, [uuid, router]);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={join}
        disabled={pending}
        className="bg-accent-fill focus-visible:outline-accent-fill flex min-h-11 items-center justify-center px-4 text-sm text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {pending ? 'Joining…' : 'Join this league'}
      </button>

      <p aria-live="polite" className="text-text-secondary min-h-5 text-xs">
        {error}
      </p>
    </div>
  );
}
