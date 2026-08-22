import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DraftListEditor, type DraftListRow } from '@/components/DraftListEditor';

/**
 * The private draft list, as a member operates it.
 *
 * 🔴 The keyboard path is tested and the mouse path is not, which is the right
 * way round: `@hello-pangea/dnd` measures real element boxes and jsdom reports
 * every box as zero, so a simulated *mouse* drag proves the library's fallback
 * rather than anything here. The keyboard path — space to lift, arrows to move,
 * space to drop — runs on the same reducer and is the one that would silently
 * rot.
 */
const ENTRIES: DraftListRow[] = [
  {
    entryId: 21,
    movieId: 11,
    title: 'Arrival',
    posterUrl: null,
    releaseYear: 2016,
    status: 'none',
  },
  {
    entryId: 22,
    movieId: 12,
    title: 'Moonlight',
    posterUrl: null,
    releaseYear: 2016,
    status: 'selected',
  },
  {
    entryId: 23,
    movieId: 13,
    title: 'Paterson',
    posterUrl: null,
    releaseYear: 2016,
    status: 'unavailable',
  },
];

const ROW_HEIGHT = 56;

const noop = async () => ({ ok: true as const, data: null });
const noResults = async () => ({ ok: true as const, data: [] });

/**
 * jsdom reports every element as a zero-sized box and `@hello-pangea/dnd`
 * refuses to start a drag it cannot measure — including a keyboard one. The
 * smallest honest stand-in for a layout: a column of `ROW_HEIGHT` boxes in DOM
 * order.
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

function theList() {
  return screen.getByRole('list', { name: /Your list/ });
}

/**
 * The films as the list currently reads them.
 *
 * Read off each row's Remove label rather than its text content: the row also
 * carries a position, a poster placeholder, a release year and a status, and a
 * regex over all of that would pass on a list rendering the wrong thing.
 */
function titlesInOrder() {
  return within(theList())
    .getAllByRole('listitem')
    .map(
      (item) =>
        within(item)
          .getByRole('button', { name: /^Remove / })
          .getAttribute('aria-label')
          ?.replace(/^Remove /, '')
          .replace(/ from your list$/, '') ?? '',
    );
}

/**
 * Lift the first row, move it down once, drop it — space, arrow, space.
 *
 * Fired rather than typed: the library's keyboard sensor reads `event.keyCode`,
 * which `user-event` does not populate, so a typed space is silently ignored and
 * the test would pass a component with no keyboard support at all.
 */
function moveFirstDown() {
  const handle = within(theList()).getAllByRole('button')[0] as HTMLElement;
  handle.focus();
  fireEvent.keyDown(handle, { keyCode: 32 });
  fireEvent.keyDown(handle, { keyCode: 40 });
  fireEvent.keyDown(handle, { keyCode: 32 });
}

function renderEditor(overrides: Partial<Parameters<typeof DraftListEditor>[0]> = {}) {
  return render(
    <DraftListEditor
      entries={ENTRIES}
      onSearch={noResults}
      onAdd={noop}
      onRemove={noop}
      onSetStatus={noop}
      onReorder={noop}
      {...overrides}
    />,
  );
}

describe('the list', () => {
  it('renders the entries in the order it was given, numbered from one', () => {
    renderEditor();

    expect(titlesInOrder()).toEqual(['Arrival', 'Moonlight', 'Paterson']);
  });

  it('invites a member who has not started one', () => {
    renderEditor({ entries: [] });

    expect(screen.getByText('Nothing on your list yet')).toBeInTheDocument();
    // The search is still there — an empty list is a page you can act on.
    expect(screen.getByLabelText('Add a film')).toBeInTheDocument();
  });

  it('🔴 reorders from the keyboard alone', async () => {
    // Drag-only would make the feature unusable for anyone not using a mouse
    // (a11y: gesture-alternative).
    const onReorder = vi.fn(noop);
    renderEditor({ onReorder });

    moveFirstDown();

    await waitFor(() => expect(onReorder).toHaveBeenCalledWith([22, 21, 23]));
  });

  it('🔴 snaps back when the server refuses', async () => {
    const onReorder = vi.fn(async () => ({
      ok: false as const,
      code: 'CONFLICT' as const,
      message: 'that ordering does not match your list',
    }));
    renderEditor({ onReorder });

    moveFirstDown();

    await waitFor(() =>
      expect(titlesInOrder()).toEqual(['Arrival', 'Moonlight', 'Paterson']),
    );
    expect(
      screen.getByText('that ordering does not match your list'),
    ).toBeInTheDocument();
  });
});

describe('the marks', () => {
  it('🔴 names every state rather than relying on colour', () => {
    renderEditor();

    // Once as the chip on the row, once as the selected option of its control.
    expect(screen.getAllByText('You took it').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Someone else took it').length).toBeGreaterThan(0);
  });

  it('sets the state the member chose, rather than toggling', async () => {
    const onSetStatus = vi.fn(noop);
    renderEditor({ onSetStatus });

    await userEvent.selectOptions(screen.getByLabelText('Mark Arrival'), 'unavailable');

    expect(onSetStatus).toHaveBeenCalledWith(21, 'unavailable');
  });

  it('can clear a mark', async () => {
    const onSetStatus = vi.fn(noop);
    renderEditor({ onSetStatus });

    await userEvent.selectOptions(screen.getByLabelText('Mark Moonlight'), 'none');

    expect(onSetStatus).toHaveBeenCalledWith(22, 'none');
  });
});

describe('adding and removing', () => {
  it('removes the row it was asked to', async () => {
    const onRemove = vi.fn(noop);
    renderEditor({ onRemove });

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Paterson from your list' }),
    );

    expect(onRemove).toHaveBeenCalledWith(23);
  });

  it('adds a local film by its own id', async () => {
    const onAdd = vi.fn(noop);
    renderEditor({
      onAdd,
      onSearch: async () => ({
        ok: true as const,
        data: [{ id: 99, tmdbId: '5000', title: 'Sinners', year: 2025, posterUrl: null }],
      }),
    });

    await userEvent.type(screen.getByLabelText('Add a film'), 'sinn');
    const result = await screen.findByRole('button', { name: /Sinners/ });
    await userEvent.click(result);

    expect(onAdd).toHaveBeenCalledWith({ movieId: 99 });
  });

  it('adds a film the app has never cached by its TMDB id', async () => {
    const onAdd = vi.fn(noop);
    renderEditor({
      onAdd,
      onSearch: async () => ({
        ok: true as const,
        data: [
          { id: null, tmdbId: '5000', title: 'Sinners', year: 2025, posterUrl: null },
        ],
      }),
    });

    await userEvent.type(screen.getByLabelText('Add a film'), 'sinn');
    await userEvent.click(await screen.findByRole('button', { name: /Sinners/ }));

    expect(onAdd).toHaveBeenCalledWith({ tmdbId: '5000' });
  });

  it('🔴 says so, and refuses, for a film already on the list', async () => {
    // A shortlist with the same film twice cannot be ranked, and the reason has
    // to be readable before the click rather than after the refusal.
    const onAdd = vi.fn(noop);
    renderEditor({
      onAdd,
      onSearch: async () => ({
        ok: true as const,
        data: [{ id: 11, tmdbId: '1', title: 'Arrival', year: 2016, posterUrl: null }],
      }),
    });

    await userEvent.type(screen.getByLabelText('Add a film'), 'arr');
    const result = await screen.findByRole('button', { name: /Already on your list/ });

    expect(result).toBeDisabled();
    await userEvent.click(result);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
