'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import { createLeague } from '@/actions/leagues/create-league';
import { cn } from '@/lib/utils/cn';

/**
 * Starting a league.
 *
 * Two fields, because the source's three-step wizard was three steps for two
 * decisions and a link to copy — and the link cannot be copied until the
 * league exists anyway, so it belongs on the league's own page rather than in
 * a step that pretends the work is not finished.
 *
 * The draft type is radios rather than a select: two options, both worth
 * reading, and a select hides the second one behind an interaction.
 */
export function CreateLeagueForm({ className }: { className?: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState<'snake' | 'linear'>('snake');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (name.trim() === '') {
        setError('Give the league a name.');
        return;
      }

      setError(null);
      startTransition(async () => {
        const result = await createLeague({ name: name.trim(), type });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        // Straight to the league, where the invite link is.
        router.push(`/leagues/${result.data.leagueId}`);
      });
    },
    [name, type, router],
  );

  return (
    <form onSubmit={submit} className={cn('flex flex-col gap-6', className)}>
      <label className="flex flex-col gap-2">
        <span className="text-text-primary text-sm">League name</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={120}
          aria-describedby="name-help"
          className="border-border-rule bg-bg-raised text-text-primary focus-visible:outline-accent-fill w-full border px-3 py-2 text-base focus-visible:outline-2"
        />
        <span id="name-help" className="text-text-dim text-xs">
          Whatever everyone already calls it.
        </span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-text-primary mb-2 text-sm">Draft order</legend>

        {(
          [
            { value: 'snake', label: 'Snake', help: 'The order reverses each round.' },
            { value: 'linear', label: 'In order', help: 'The same order every round.' },
          ] as const
        ).map((option) => (
          <label
            key={option.value}
            className={cn(
              'border-border-rule flex min-h-11 cursor-pointer items-start gap-3 border p-3',
              type === option.value && 'border-l-accent-fill border-l-2 bg-bg-raised',
            )}
          >
            <input
              type="radio"
              name="type"
              value={option.value}
              checked={type === option.value}
              onChange={() => setType(option.value)}
              className="mt-1"
            />
            <span className="flex flex-col">
              <span className="text-text-primary text-sm">{option.label}</span>
              <span className="text-text-dim text-xs">{option.help}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <p aria-live="polite" className="text-text-secondary min-h-5 text-xs">
        {error}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="bg-accent-fill focus-visible:outline-accent-fill flex min-h-11 items-center justify-center px-4 text-sm text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {pending ? 'Creating…' : 'Create league'}
      </button>
    </form>
  );
}
