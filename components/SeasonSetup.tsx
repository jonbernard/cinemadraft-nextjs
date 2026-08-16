'use client';

import { useCallback, useState, useTransition } from 'react';
import { startDraft } from '@/actions/leagues/manage-league';
import {
  addDummySeat,
  assignSeats,
  randomiseGroups,
  removeSeat,
} from '@/actions/leagues/manage-seats';
import { cn } from '@/lib/utils/cn';

export type SetupSeatView = {
  draftId: number;
  name: string;
  isDummy: boolean;
  group: number | null;
  order: number | null;
  hasPicks: boolean;
};

/**
 * Arranging a season before the draft (P10.T14–T17).
 *
 * **Desktop-first (D49)**, the stated exception: this is done once a year from
 * a laptop, in the hour before a video call.
 *
 * 🔴 **Group assignment is a `<select>` per seat, not drag-and-drop.** The
 * source used dragging, and dragging alone is unusable without a mouse
 * (a11y `gesture-alternative`) — `PickList` gets away with it only because
 * `@hello-pangea/dnd` ships a keyboard path. A select is operable by keyboard,
 * by screen reader and by touch with no library at all, and for "put this
 * person in group 3" it is also *faster* than dragging across a wide board.
 *
 * Every change saves immediately. There is no Save button because there is no
 * moment when a half-arranged league is worth keeping in a draft state — and a
 * form that batches changes invites the owner to close the tab having lost
 * them.
 */
export function SeasonSetup({
  leagueId,
  year,
  seats,
  groups,
  suggestedGroupCount,
  status,
  className,
}: {
  leagueId: number;
  year: number;
  seats: readonly SetupSeatView[];
  groups: readonly number[];
  suggestedGroupCount: number;
  status: string | null;
  className?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [dummyName, setDummyName] = useState('');
  const [groupCount, setGroupCount] = useState(suggestedGroupCount);
  const [pending, startTransition] = useTransition();

  const isPending = status === 'pending';

  // One group more than exists, so there is always somewhere new to put
  // someone without adding a group first.
  const options = [...new Set([...groups, groups.length + 1, 1])].sort((a, b) => a - b);

  const run = useCallback(
    (work: () => Promise<{ ok: boolean; message?: string }>, success?: string) => {
      setMessage(null);
      startTransition(async () => {
        const result = await work();
        setMessage(
          result.ok ? (success ?? null) : (result.message ?? 'That did not work'),
        );
      });
    },
    [],
  );

  const setGroup = useCallback(
    (draftId: number, group: number | null) => {
      const inGroup = seats.filter(
        (seat) => seat.group === group && seat.draftId !== draftId,
      );
      run(() =>
        assignSeats({
          leagueId,
          assignments: [
            { draftId, group, order: group == null ? null : inGroup.length + 1 },
          ],
        }),
      );
    },
    [leagueId, seats, run],
  );

  const onDummyNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setDummyName(event.target.value);
  }, []);

  const onGroupCountChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setGroupCount(Number(event.target.value));
  }, []);

  const addSeat = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const name = dummyName.trim();
      if (name === '') return;
      run(() => addDummySeat({ leagueId, year, dummyName: name }), `${name} seated`);
      setDummyName('');
    },
    [dummyName, leagueId, year, run],
  );

  const deal = useCallback(() => {
    run(
      () => randomiseGroups({ leagueId, year, groupCount }),
      'Everyone dealt into groups',
    );
  }, [leagueId, year, groupCount, run]);

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <section className="flex flex-col gap-3">
        <h2 className="text-text-dim text-xs font-normal uppercase tracking-wide">
          Who is playing
        </h2>

        <ul className="flex flex-col">
          {seats.map((seat) => (
            <SeatRow
              key={seat.draftId}
              seat={seat}
              leagueId={leagueId}
              options={options}
              disabled={pending}
              editable={isPending}
              onSetGroup={setGroup}
              onDone={setMessage}
            />
          ))}
        </ul>

        {isPending ? (
          <form className="flex flex-wrap items-end gap-3" onSubmit={addSeat}>
            <label className="flex flex-col gap-1">
              <span className="text-text-dim text-xs">
                Add someone without an account
              </span>
              <input
                type="text"
                value={dummyName}
                onChange={onDummyNameChange}
                placeholder="Their name"
                className="border-border-rule bg-bg-raised text-text-primary focus-visible:outline-accent-fill min-h-11 border px-3 text-sm focus-visible:outline-2"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="border-border-rule text-text-primary hover:bg-bg-raised focus-visible:outline-accent-fill min-h-11 border px-4 text-sm disabled:opacity-60 focus-visible:outline-2"
            >
              Add seat
            </button>
          </form>
        ) : null}
      </section>

      {isPending ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-text-dim text-xs font-normal uppercase tracking-wide">
            Groups
          </h2>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-text-dim text-xs">How many groups</span>
              <input
                type="number"
                min={1}
                max={20}
                value={groupCount}
                onChange={onGroupCountChange}
                className="border-border-rule bg-bg-raised text-text-primary focus-visible:outline-accent-fill min-h-11 w-24 border px-3 text-sm focus-visible:outline-2"
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={deal}
              className="border-border-rule text-text-primary hover:bg-bg-raised focus-visible:outline-accent-fill min-h-11 border px-4 text-sm disabled:opacity-60 focus-visible:outline-2"
            >
              Deal at random
            </button>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-text-dim text-xs font-normal uppercase tracking-wide">
          The draft
        </h2>

        {isPending ? (
          <StartDraftButton
            leagueId={leagueId}
            year={year}
            disabled={pending}
            onDone={setMessage}
          />
        ) : (
          <p className="text-text-secondary text-sm">
            This draft is {status}. Groups are fixed once it starts.
          </p>
        )}
      </section>

      <p aria-live="polite" className="text-text-secondary min-h-5 text-sm">
        {pending ? 'Saving…' : (message ?? '')}
      </p>
    </div>
  );
}

/**
 * One person's row.
 *
 * Its own component so the select's handler memoises against the seat rather
 * than being rebuilt for every row on every keystroke elsewhere on the page.
 */
function SeatRow({
  seat,
  leagueId,
  options,
  disabled,
  editable,
  onSetGroup,
  onDone,
}: {
  seat: SetupSeatView;
  leagueId: number;
  options: readonly number[];
  disabled: boolean;
  editable: boolean;
  onSetGroup: (draftId: number, group: number | null) => void;
  onDone: (message: string | null) => void;
}) {
  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      onSetGroup(
        seat.draftId,
        event.target.value === '' ? null : Number(event.target.value),
      );
    },
    [onSetGroup, seat.draftId],
  );

  return (
    <li className="border-border-rule flex flex-wrap items-center gap-3 border-b py-3">
      <span className="text-text-primary min-w-40 flex-1 text-sm">
        {seat.name}
        {seat.isDummy ? <span className="text-text-dim"> · placeholder</span> : null}
      </span>

      <label className="flex items-center gap-2 text-xs">
        <span className="text-text-dim">Group</span>
        <select
          value={seat.group ?? ''}
          disabled={disabled || !editable}
          onChange={onChange}
          className="border-border-rule bg-bg-raised text-text-primary focus-visible:outline-accent-fill min-h-11 border px-2 text-sm focus-visible:outline-2"
        >
          <option value="">Unassigned</option>
          {options.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
      </label>

      {/* 🔴 A seat that has drafted cannot be removed — the picks have no
          foreign key and would be orphaned. Saying so beats a button that
          always refuses. */}
      {seat.hasPicks ? (
        <span className="text-text-dim text-xs">has picks</span>
      ) : (
        <RemoveSeatButton
          leagueId={leagueId}
          draftId={seat.draftId}
          name={seat.name}
          disabled={disabled}
          onDone={onDone}
        />
      )}
    </li>
  );
}

/**
 * 🔴 Removing a seat confirms first.
 *
 * Mid-season it is hard to undo: the person has to be re-invited or re-added,
 * and if they were mid-draft their picks are gone with them. `confirm` rather
 * than a custom dialog because it is unmissable, cannot be mis-styled, and the
 * only thing worse than an ugly confirmation is one someone clicks through.
 */
function RemoveSeatButton({
  leagueId,
  draftId,
  name,
  disabled,
  onDone,
}: {
  leagueId: number;
  draftId: number;
  name: string;
  disabled: boolean;
  onDone: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();

  const remove = useCallback(() => {
    if (!window.confirm(`Remove ${name} from this league?`)) return;
    startTransition(async () => {
      const result = await removeSeat({ leagueId, draftId });
      onDone(result.ok ? `${name} removed` : result.message);
    });
  }, [leagueId, draftId, name, onDone]);

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={remove}
      className="text-text-dim hover:text-text-primary focus-visible:outline-accent-fill min-h-11 text-xs underline focus-visible:outline-2"
    >
      Remove
    </button>
  );
}

/** 🔴 Starting the draft confirms too: groups are fixed from that moment. */
function StartDraftButton({
  leagueId,
  year,
  disabled,
  onDone,
}: {
  leagueId: number;
  year: number;
  disabled: boolean;
  onDone: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();

  const start = useCallback(() => {
    if (!window.confirm('Start the draft? Groups cannot be changed afterwards.')) return;
    startTransition(async () => {
      const result = await startDraft({ leagueId, year });
      onDone(result.ok ? 'The draft is open' : result.message);
    });
  }, [leagueId, year, onDone]);

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={start}
      className="bg-accent-fill focus-visible:outline-accent-fill min-h-11 w-fit px-4 text-sm text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      Start the draft
    </button>
  );
}
