'use client';

import { useCallback, useState, useTransition } from 'react';

import { updateEvent } from '@/actions/admin/update-event';
import { cn } from '@/lib/utils/cn';

export type AdminEvent = {
  id: number;
  name: string;
  abbreviation: string;
  image: string | null;
  nomDuration: number | null;
  awardsDuration: number | null;
  hasCeremony: boolean;
};

/** The season the dialog dates (the page's `?year=`), and its stored row, if any. */
export type AdminSeason = {
  year: number;
  dates: {
    nomDate: number | null;
    nomTime: number | null;
    awardsDate: number | null;
    awardsTime: number | null;
  } | null;
};

/**
 * UTC midnight of the day as the admin typed it, in epoch milliseconds: what
 * `nomDate` stores (the award-entry skill and the M3 backfill write the same),
 * and what keeps a day inside its season whatever the browser's zone. The
 * time is the rest of the instant, so an 8pm ET ceremony is 25 hours past it.
 */
function dayMidnight(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
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
  const midnight = dayMidnight(moment);
  return { date: midnight, time: moment.getTime() - midnight };
}

/**
 * Edit a show's name, mark and one season's dates (T26, D134).
 *
 * The dates are `season.year`'s, read from and written to `event_dates`; the
 * action copies them to `events` only for the active season. They start empty
 * for a season with no row.
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
  season,
  className,
}: {
  event: AdminEvent;
  season: AdminSeason;
  className?: string;
}) {
  const dates = season.dates;
  const [name, setName] = useState(event.name);
  const [abbreviation, setAbbreviation] = useState(event.abbreviation);
  const [image, setImage] = useState(event.image ?? '');
  const [nomAt, setNomAt] = useState(
    toLocalInput(dates?.nomDate ?? null, dates?.nomTime ?? null),
  );
  const [nomMinutes, setNomMinutes] = useState(
    event.nomDuration == null ? '' : String(Math.round(event.nomDuration / 60_000)),
  );
  const [awardsAt, setAwardsAt] = useState(
    toLocalInput(dates?.awardsDate ?? null, dates?.awardsTime ?? null),
  );
  const [awardsMinutes, setAwardsMinutes] = useState(
    event.awardsDuration == null ? '' : String(Math.round(event.awardsDuration / 60_000)),
  );
  const [hasCeremony, setHasCeremony] = useState(event.hasCeremony);
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
      // D129: a show with no ceremony has no awards date.
      const awards = hasCeremony ? fromLocalInput(awardsAt) : null;
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
          nomDuration,
          awardsDuration,
          hasCeremony,
          season: {
            year: season.year,
            nomDate: nom?.date ?? null,
            nomTime: nom?.time ?? null,
            awardsDate: awards?.date ?? null,
            awardsTime: awards?.time ?? null,
          },
        });
        setMessage(result.ok ? 'Saved' : result.message);
      });
    },
    [
      event.id,
      season.year,
      name,
      abbreviation,
      image,
      nomAt,
      nomMinutes,
      awardsAt,
      awardsMinutes,
      hasCeremony,
    ],
  );

  return (
    <form onSubmit={submit} className={cn('flex flex-col gap-4', className)}>
      {/* 🔴 No live controls here. On air (`awards_active`) is the switch in
          Winners mode, beside the categories it is about. `nom_active` is not
          written: in the source it was a side effect of entering Nominations
          mode, and nothing in the port reads it now — "still needs
          nominations" is derived from dates (`lib/services/entry-status.ts`).
          `live_results` is not written: no source UI ever
          set it, and nothing in the port reads it. All three columns keep
          whatever is stored. */}
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-text-dim text-xs">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-border-rule bg-bg-surface text-text-primary min-h-11 border px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-dim text-xs">Abbreviation</span>
          <input
            type="text"
            value={abbreviation}
            onChange={(e) => setAbbreviation(e.target.value)}
            className="border-border-rule bg-bg-surface text-text-primary min-h-11 border px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-dim text-xs">Image URL</span>
          <input
            type="text"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            className="border-border-rule bg-bg-surface text-text-primary min-h-11 border px-3 text-sm"
          />
        </label>
      </div>

      <h3 className="text-text-primary text-sm font-semibold">
        {season.year} season dates
      </h3>

      <fieldset className="flex flex-wrap items-end gap-3">
        <legend className="text-text-dim mb-1 text-xs">Nominations</legend>
        <label className="flex flex-col gap-1">
          <span className="text-text-dim text-xs">Announced</span>
          <input
            type="datetime-local"
            value={nomAt}
            onChange={(e) => setNomAt(e.target.value)}
            className="border-border-rule bg-bg-surface text-text-primary min-h-11 border px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-dim text-xs">Minutes</span>
          <input
            type="number"
            min={0}
            value={nomMinutes}
            onChange={(e) => setNomMinutes(e.target.value)}
            className="border-border-rule bg-bg-surface text-text-primary min-h-11 w-24 border px-3 text-sm"
          />
        </label>
      </fieldset>

      {/* D129: a show with no ceremony (the AFI) has one moment on the rail,
          and never needs winners. A setting, not a live control. */}
      <label className="flex min-h-11 w-fit items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasCeremony}
          onChange={(e) => setHasCeremony(e.target.checked)}
          className="size-5"
        />
        This show has a ceremony
      </label>

      {hasCeremony ? (
        <fieldset className="flex flex-wrap items-end gap-3">
          <legend className="text-text-dim mb-1 text-xs">Awards</legend>
          <label className="flex flex-col gap-1">
            <span className="text-text-dim text-xs">Announced</span>
            <input
              type="datetime-local"
              value={awardsAt}
              onChange={(e) => setAwardsAt(e.target.value)}
              className="border-border-rule bg-bg-surface text-text-primary min-h-11 border px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-dim text-xs">Minutes</span>
            <input
              type="number"
              min={0}
              value={awardsMinutes}
              onChange={(e) => setAwardsMinutes(e.target.value)}
              className="border-border-rule bg-bg-surface text-text-primary min-h-11 w-24 border px-3 text-sm"
            />
          </label>
        </fieldset>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="border-border-rule text-text-primary hover:bg-bg-surface min-h-11 w-fit border px-4 text-sm disabled:opacity-60"
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
