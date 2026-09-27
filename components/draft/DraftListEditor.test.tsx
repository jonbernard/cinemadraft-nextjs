import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DraftListEditor, type DraftListRow } from '@/components/draft/DraftListEditor';

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

function rowFor(title: string): HTMLElement {
  const row = within(theList())
    .getAllByRole('listitem')
    .find((item) =>
      within(item).queryByRole('button', { name: `Remove ${title} from your list` }),
    );
  if (!row) throw new Error(`no row for ${title}`);
  return row;
}

/** The row's own names for a state, with the `<select>`'s options discounted. */
function chipsIn(row: HTMLElement, label: string): HTMLElement[] {
  return within(row)
    .queryAllByText(label)
    .filter((node) => node.closest('select') == null);
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

  it('reorders from the keyboard alone', async () => {
    // Drag-only would make the feature unusable for anyone not using a mouse
    // (a11y: gesture-alternative).
    const onReorder = vi.fn(noop);
    renderEditor({ onReorder });

    moveFirstDown();

    await waitFor(() => expect(onReorder).toHaveBeenCalledWith([22, 21, 23]));
  });

  it('snaps back when the server refuses', async () => {
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
  it('names every state rather than relying on colour', () => {
    renderEditor();

    // Every row renders all three names as `<option>` text, so a count over the
    // whole page proves nothing. The marked row has to carry its name a second
    // time, outside the `<select>`, and an unmarked row must not.
    expect(chipsIn(rowFor('Moonlight'), 'You took it')).toHaveLength(1);
    expect(chipsIn(rowFor('Arrival'), 'You took it')).toHaveLength(0);

    expect(chipsIn(rowFor('Paterson'), 'Someone else took it')).toHaveLength(1);
    expect(chipsIn(rowFor('Arrival'), 'Someone else took it')).toHaveLength(0);
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

/** The row's poster slot, which is the only thing a taken row fades. */
function posterOf(row: HTMLElement): HTMLElement {
  const slot = row.querySelector<HTMLElement>('[data-slot="poster"]');
  if (!slot) throw new Error('row has no poster slot');
  return slot;
}

function titleOf(row: HTMLElement, title: string): HTMLElement {
  return within(row).getByText(title, { selector: 'span.font-serif' });
}

describe('a film the drafts say is taken', () => {
  const TAKEN: DraftListRow[] = [
    {
      ...(ENTRIES[0] as DraftListRow),
      drafted: { yours: false, by: 'Rhoda Vance', gone: true },
    },
    { ...(ENTRIES[1] as DraftListRow), status: 'none', drafted: { yours: true } },
    {
      ...(ENTRIES[2] as DraftListRow),
      status: 'none',
      drafted: { yours: false, by: 'Ada in Oscar Pool', gone: false },
    },
    {
      entryId: 24,
      movieId: 14,
      title: 'Nope',
      posterUrl: null,
      releaseYear: 2022,
      status: 'none',
    },
  ];

  it('fades the row and says who took it, in words', () => {
    renderEditor({ entries: TAKEN });
    const row = rowFor('Arrival');

    expect(within(row).getByText('Taken · Rhoda Vance')).toBeInTheDocument();
    // 🔴 The poster fades; the title changes ink rather than opacity, because
    // text at 50% fails AA on the light panel (3.37:1).
    expect(posterOf(row)).toHaveClass('opacity-50');
    expect(titleOf(row, 'Arrival')).toHaveClass('text-text-secondary');
    expect(titleOf(row, 'Arrival')).not.toHaveClass('opacity-50');
  });

  it('leaves an untaken row at full strength', () => {
    renderEditor({ entries: TAKEN });
    const row = rowFor('Nope');

    expect(posterOf(row)).not.toHaveClass('opacity-50');
    expect(titleOf(row, 'Nope')).toHaveClass('text-text-primary');
    expect(within(row).queryByText(/^Taken ·/)).toBeNull();
  });

  it('calls the reader’s own pick theirs, unfaded', () => {
    renderEditor({ entries: TAKEN });
    const row = rowFor('Moonlight');

    expect(chipsIn(row, 'You took it')).toHaveLength(1);
    expect(posterOf(row)).not.toHaveClass('opacity-50');
  });

  it('names a film gone in one league of two but does not fade it', () => {
    renderEditor({ entries: TAKEN });
    const row = rowFor('Paterson');

    expect(within(row).getByText('Taken · Ada in Oscar Pool')).toBeInTheDocument();
    expect(posterOf(row)).not.toHaveClass('opacity-50');
  });

  it('drops the manual mark once the drafts know, but keeps remove and reorder', async () => {
    const onRemove = vi.fn(noop);
    const onReorder = vi.fn(noop);
    renderEditor({ entries: TAKEN, onRemove, onReorder });

    expect(screen.queryByLabelText('Mark Arrival')).toBeNull();
    expect(screen.getByLabelText('Mark Nope')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Arrival from your list' }),
    );
    expect(onRemove).toHaveBeenCalledWith(21);

    moveFirstDown();
    await waitFor(() => expect(onReorder).toHaveBeenCalledWith([22, 21, 23, 24]));
  });

  it('fades a film marked gone by hand the same way', () => {
    renderEditor();

    expect(posterOf(rowFor('Paterson'))).toHaveClass('opacity-50');
    expect(posterOf(rowFor('Arrival'))).not.toHaveClass('opacity-50');
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

  it('says so, and refuses, for a film already on the list', async () => {
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
