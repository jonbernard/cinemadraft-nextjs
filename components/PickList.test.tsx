import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ListPick, PickList } from '@/components/PickList';

/**
 * Reordering a seat's picks.
 *
 * 🔴 The keyboard path is tested and the mouse path is not, which is the right
 * way round: `@hello-pangea/dnd` measures real element boxes, and jsdom
 * reports every box as zero, so a simulated *mouse* drag there proves the
 * library's fallback behaviour rather than ours. The keyboard path — space to
 * lift, arrows to move, space to drop — runs on the same reducer and is the
 * one that would silently rot, because nobody reaches for it by accident. The
 * pointer drag is covered by the E2E suite in a real browser.
 */
const PICKS: ListPick[] = [
  { pickId: 11, round: 1, title: 'Arrival', posterUrl: null },
  { pickId: 12, round: 2, title: 'Moonlight', posterUrl: null },
  { pickId: 13, round: 3, title: 'Paterson', posterUrl: null },
];

const ROW_HEIGHT = 56;

/**
 * jsdom reports every element as a zero-sized box, and `@hello-pangea/dnd`
 * refuses to start a drag it cannot measure — including a keyboard one. So the
 * rows are given real geometry: a column of `ROW_HEIGHT` boxes, in DOM order.
 *
 * This is the smallest honest stand-in for a layout. It fakes *where things
 * are*, which jsdom has no opinion about anyway, and fakes nothing about what
 * the component does with a completed drag — which is the whole subject here.
 */
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const draggable = this.getAttribute('data-rfd-draggable-id');
    const list = this.closest('ul') ?? this.querySelector('ul');
    const rows = list ? [...list.querySelectorAll('[data-rfd-draggable-id]')] : [];
    const index = draggable
      ? rows.findIndex((row) => row.getAttribute('data-rfd-draggable-id') === draggable)
      : -1;

    const top = index >= 0 ? index * ROW_HEIGHT : 0;
    const height = index >= 0 ? ROW_HEIGHT : Math.max(rows.length, 1) * ROW_HEIGHT;

    return {
      top,
      bottom: top + height,
      left: 0,
      right: 320,
      width: 320,
      height,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function titlesInOrder() {
  return within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .map((item) => item.textContent?.replace(/^\d+/, '') ?? '');
}

/**
 * Lift the first pick, move it down once, drop it — space, arrow, space.
 *
 * Fired rather than typed: the library's keyboard sensor reads `event.keyCode`
 * (32 for space, 40 for arrow-down), which `user-event` does not populate, so
 * a typed space is silently ignored and the test would pass a component that
 * had no keyboard support at all.
 */
function moveFirstDown() {
  const first = within(screen.getByRole('list')).getAllByRole('button')[0] as HTMLElement;
  first.focus();
  fireEvent.keyDown(first, { keyCode: 32 });
  fireEvent.keyDown(first, { keyCode: 40 });
  fireEvent.keyDown(first, { keyCode: 32 });
}

describe('PickList', () => {
  it('lists the picks in the order it was given, numbered from one', () => {
    render(<PickList picks={PICKS} onReorder={vi.fn()} />);

    expect(titlesInOrder()).toEqual(['Arrival', 'Moonlight', 'Paterson']);
  });

  it('says so for a seat with nothing yet', () => {
    render(<PickList picks={[]} onReorder={vi.fn()} />);

    expect(screen.getByText('No picks yet.')).toBeInTheDocument();
  });

  it('🔴 reorders from the keyboard alone', async () => {
    // Drag-only would make the feature unusable for anyone not using a mouse
    // (a11y: gesture-alternative).
    const onReorder = vi.fn(async () => ({ ok: true as const, data: null }));
    render(<PickList picks={PICKS} onReorder={onReorder} />);

    moveFirstDown();

    await waitFor(() => expect(onReorder).toHaveBeenCalledWith([12, 11, 13]));
  });

  it('moves the item before the server answers', async () => {
    // A drag that waits for a round trip feels broken.
    // Initialised to a no-op rather than null: assigning inside the promise
    // executor narrows a nullable to `never` for the later call.
    let release = (): void => {};
    const onReorder = vi.fn(
      () =>
        new Promise<{ ok: true; data: null }>((resolve) => {
          release = () => resolve({ ok: true, data: null });
        }),
    );
    render(<PickList picks={PICKS} onReorder={onReorder} />);

    moveFirstDown();

    await waitFor(() =>
      expect(titlesInOrder()).toEqual(['Moonlight', 'Arrival', 'Paterson']),
    );
    release();
  });

  it('🔴 snaps back when the server refuses', async () => {
    // The board is what the league is watching, and it now disagrees with this
    // list. Showing the move as if it stuck would be a lie about the draft.
    let refuse = (): void => {};
    type Refusal = { ok: false; code: 'CONFLICT'; message: string };
    const onReorder = vi.fn(
      () =>
        new Promise<Refusal>((resolve) => {
          refuse = () =>
            resolve({
              ok: false,
              code: 'CONFLICT',
              message: 'that ordering does not match this seat’s picks',
            });
        }),
    );
    render(<PickList picks={PICKS} onReorder={onReorder} />);

    moveFirstDown();

    // It has to move first, or "snaps back" would pass on a list that never
    // moved at all.
    await waitFor(() =>
      expect(titlesInOrder()).toEqual(['Moonlight', 'Arrival', 'Paterson']),
    );
    refuse();

    await waitFor(() =>
      expect(titlesInOrder()).toEqual(['Arrival', 'Moonlight', 'Paterson']),
    );
    expect(
      screen.getByText('that ordering does not match this seat’s picks'),
    ).toBeInTheDocument();
  });

  it('takes new props as the truth rather than merging them', async () => {
    // A pick added or removed elsewhere on the page arrives here as props; a
    // stale optimistic order must not survive it.
    const { rerender } = render(<PickList picks={PICKS} onReorder={vi.fn()} />);

    rerender(
      <PickList
        picks={[{ pickId: 14, round: 1, title: 'Jackie', posterUrl: null }]}
        onReorder={vi.fn()}
      />,
    );

    expect(titlesInOrder()).toEqual(['Jackie']);
  });
});
