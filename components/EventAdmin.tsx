'use client';

import { useCallback, useState, useTransition } from 'react';

import { updateEvent } from '@/actions/admin/update-event';
import { cn } from '@/lib/utils/cn';

export type AdminEvent = {
  id: number;
  name: string;
  abbreviation: string;
  image: string | null;
  nomActive: boolean | null;
  nomDate: number | null;
  nomTime: number | null;
  nomDuration: number | null;
  awardsActive: boolean | null;
  awardsDate: number | null;
  awardsTime: number | null;
  awardsDuration: number | null;
  liveResults: boolean | null;
};

/** Local midnight of a `Date`, in epoch milliseconds — what `nomDate` stores. */
function localMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Combine a date-at-midnight and a ms-past-midnight offset into one `datetime-local` value. */
function toLocalInput(dateMs: number | null, timeMs: number | null): string {
  if (dateMs == null) return '';
  const combined = new Date(dateMs + (timeMs ?? 0));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${combined.getFullYear()}-${pad(combined.getMonth() + 1)}-${pad(combined.getDate())}T${pad(combined.getHours())}:${pad(combined.getMinutes())}`;
}

/** The reverse of {@link toLocalInput}: a moment back into the schema's two columns. */
function fromLocalInput(value: string): { date: number; time: number } | null {
  if (value === '') return null;
  const moment = new Date(value);
  if (Number.isNaN(moment.getTime())) return null;
  const midnight = localMidnight(moment);
  return { date: midnight, time: moment.getTime() - midnight };
}

/**
 * Edit a show's dates and live flags (T26).
 *
 * 🔴 Desktop-first, the stated exception (D49): an admin sets ceremony dates
 * once a season, from a laptop.
 *
 * `nomDate`/`nomTime` and `awardsDate`/`awardsTime` are two columns each in
 * the schema — a midnight and an offset — so this presents one moment per
 * ceremony and splits it back apart on submit rather than exposing four raw
 * number fields nobody could read.
 */
export function EventAdmin({
  event,
  className,
}: {
  event: AdminEvent;
  className?: string;
}) {
  const [name, setName] = useState(event.name);
  const [abbreviation, setAbbreviation] = useState(event.abbreviation);
  const [image, setImage] = useState(event.image ?? '');
  const [nomActive, setNomActive] = useState(event.nomActive === true);
  const [nomAt, setNomAt] = useState(toLocalInput(event.nomDate, event.nomTime));
  const [nomMinutes, setNomMinutes] = useState(
    event.nomDuration == null ? '' : String(Math.round(event.nomDuration / 60_000)),
  );
  const [awardsActive, setAwardsActive] = useState(event.awardsActive === true);
  const [awardsAt, setAwardsAt] = useState(
    toLocalInput(event.awardsDate, event.awardsTime),
  );
  const [awardsMinutes, setAwardsMinutes] = useState(
    event.awardsDuration == null ? '' : String(Math.round(event.awardsDuration / 60_000)),
  );
  const [liveResults, setLiveResults] = useState(event.liveResults === true);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = useCallback(
    (formEvent: React.FormEvent) => {
      formEvent.preventDefault();
      const trimmedName = name.trim();
      const trimmedAbbr = abbreviation.trim();
      if (trimmedName === '' || trimmedAbbr === '') {
        setMessage('Name and abbreviation are required.');
        return;
      }

      const nom = fromLocalInput(nomAt);
      const awards = fromLocalInput(awardsAt);
      const nomDuration = nomMinutes.trim() === '' ? null : Number(nomMinutes) * 60_000;
      const awardsDuration =
        awardsMinutes.trim() === '' ? null : Number(awardsMinutes) * 60_000;

      setMessage(null);
      startTransition(async () => {
        const result = await updateEvent({
          eventId: event.id,
          name: trimmedName,
          abbreviation: trimmedAbbr,
          image: image.trim() === '' ? null : image.trim(),
          nomActive,
          nomDate: nom?.date ?? null,
          nomTime: nom?.time ?? null,
          nomDuration,
          awardsActive,
          awardsDate: awards?.date ?? null,
          awardsTime: awards?.time ?? null,
          awardsDuration,
          liveResults,
        });
        setMessage(result.ok ? 'Saved' : result.message);
      });
    },
    [
      event.id,
      name,
      abbreviation,
      image,
      nomActive,
      nomAt,
      nomMinutes,
      awardsActive,
      awardsAt,
      awardsMinutes,
      liveResults,
    ],
  );

  return (
    <form onSubmit={submit} className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-text-dim text-xs">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-border-rule bg-bg-raised text-text-primary min-h-11 border px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-dim text-xs">Abbreviation</span>
          <input
            type="text"
            value={abbreviation}
            onChange={(e) => setAbbreviation(e.target.value)}
            className="border-border-rule bg-bg-raised text-text-primary min-h-11 border px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-dim text-xs">Image URL</span>
          <input
            type="text"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            className="border-border-rule bg-bg-raised text-text-primary min-h-11 border px-3 text-sm"
          />
        </label>
      </div>

      <fieldset className="flex flex-wrap items-end gap-3">
        <legend className="text-text-dim mb-1 text-xs">Nominations</legend>
        <label className="flex min-h-11 items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={nomActive}
            onChange={(e) => setNomActive(e.target.checked)}
          />
          <span className="text-text-dim">Live now</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-dim text-xs">Announced</span>
          <input
            type="datetime-local"
            value={nomAt}
            onChange={(e) => setNomAt(e.target.value)}
            className="border-border-rule bg-bg-raised text-text-primary min-h-11 border px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-dim text-xs">Minutes</span>
          <input
            type="number"
            min={0}
            value={nomMinutes}
            onChange={(e) => setNomMinutes(e.target.value)}
            className="border-border-rule bg-bg-raised text-text-primary min-h-11 w-24 border px-3 text-sm"
          />
        </label>
      </fieldset>

      <fieldset className="flex flex-wrap items-end gap-3">
        <legend className="text-text-dim mb-1 text-xs">Awards</legend>
        <label className="flex min-h-11 items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={awardsActive}
            onChange={(e) => setAwardsActive(e.target.checked)}
          />
          <span className="text-text-dim">Live now</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-dim text-xs">Announced</span>
          <input
            type="datetime-local"
            value={awardsAt}
            onChange={(e) => setAwardsAt(e.target.value)}
            className="border-border-rule bg-bg-raised text-text-primary min-h-11 border px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-dim text-xs">Minutes</span>
          <input
            type="number"
            min={0}
            value={awardsMinutes}
            onChange={(e) => setAwardsMinutes(e.target.value)}
            className="border-border-rule bg-bg-raised text-text-primary min-h-11 w-24 border px-3 text-sm"
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={liveResults}
            onChange={(e) => setLiveResults(e.target.checked)}
          />
          <span className="text-text-dim">Live results</span>
        </label>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="border-border-rule text-text-primary hover:bg-bg-raised min-h-11 w-fit border px-4 text-sm disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save show'}
        </button>
        <p aria-live="polite" className="text-text-secondary min-h-5 text-xs">
          {message ?? ''}
        </p>
      </div>
    </form>
  );
}
