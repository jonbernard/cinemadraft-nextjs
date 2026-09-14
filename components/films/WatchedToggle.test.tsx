import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ActionResult } from '@/actions/result';
import { ok } from '@/actions/result';
import { WatchedToggle } from '@/components/films/WatchedToggle';

/**
 * The badge on a poster, and the four things the source's `WatchButton` got
 * wrong: state carried only by an icon, an accessible name that names no film,
 * no revert on failure, and a request chosen from stale local state.
 *
 * Every assertion here goes through the accessible name or `aria-pressed`,
 * never the glyph — the glyph is decoration, and testing it would pin the
 * decoration rather than the meaning.
 */
/**
 * The prop's real type, named once.
 *
 * `ReturnType<typeof vi.fn>` was the first attempt and is `Mock<Procedure>` —
 * which accepts anything and therefore checks nothing, so a test could pass a
 * handler with the wrong signature and only fail at runtime.
 */
type ChangeHandler = (input: {
  tmdbId: string;
  watched: boolean;
}) => Promise<ActionResult<{ watched: boolean }>>;

/**
 * What the eye actually reads: the text nodes, minus anything hidden from
 * sight. An assertion on `textContent` would pass for an `sr-only` span, which
 * is the failure mode being tested for.
 */
function visibleText(element: HTMLElement): string {
  return [...element.querySelectorAll('*')]
    .filter(
      (node) =>
        node.children.length === 0 &&
        !node.className.toString().includes('sr-only') &&
        node.getAttribute('aria-hidden') !== 'true' &&
        !node.closest('[aria-hidden="true"]'),
    )
    .map((node) => node.textContent?.trim() ?? '')
    .join(' ')
    .trim();
}

function renderToggle(
  options: {
    watched?: boolean;
    onChange?: ChangeHandler;
    title?: string;
    hint?: 'label' | 'tooltip';
  } = {},
) {
  const onChange = options.onChange ?? vi.fn(async () => ok({ watched: true }));
  render(
    <WatchedToggle
      tmdbId="313369"
      title={options.title ?? 'La La Land'}
      watched={options.watched ?? false}
      onChange={onChange}
      hint={options.hint ?? 'label'}
    />,
  );
  return { onChange, button: screen.getByRole('button') };
}

describe('what a screen reader hears', () => {
  it('names the film, so twenty badges on a grid are distinguishable', () => {
    renderToggle({ title: 'Sinners' });

    expect(
      screen.getByRole('button', { name: /Mark as watched: Sinners/i }),
    ).toBeTruthy();
  });

  it('announces the state through aria-pressed, not the icon', () => {
    const { button } = renderToggle({ watched: true });

    // The source carried this in a plus-versus-check swap, so a screen reader
    // heard "button" in both states.
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toMatch(/watched/i);
  });

  it('says what pressing it will do when the film is already watched', () => {
    renderToggle({ watched: true });

    expect(screen.getByRole('button', { name: /Mark as not watched/i })).toBeTruthy();
  });
});

describe('the target', () => {
  it('is at least 44px, because it sits inside a poster that is also a link', () => {
    // A target covering only the glyph is a mis-tap that navigates away instead
    // of marking the film.
    const { button } = renderToggle();

    expect(button.className).toContain('min-h-11');
    expect(button.className).toContain('min-w-11');
  });
});

describe('pressing it', () => {
  it('sends the state it wants, not a toggle', async () => {
    // 🔴 A stale badge would otherwise send the wrong request: an out-of-date
    // check issues a delete for a row already gone.
    const onChange = vi.fn(async () => ok({ watched: true }));
    const { button } = renderToggle({ onChange });

    button.click();

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ tmdbId: '313369', watched: true }),
    );
  });

  it('flips immediately rather than waiting for the round trip', async () => {
    let release: (() => void) | undefined;
    const onChange: ChangeHandler = () =>
      new Promise((resolve) => {
        release = () => resolve(ok({ watched: true }));
      });
    const { button } = renderToggle({ onChange });

    button.click();

    // Still in flight, and already pressed: a badge that waits for the server
    // feels broken on a grid of twenty posters.
    await waitFor(() => expect(button.getAttribute('aria-pressed')).toBe('true'));
    release?.();
  });

  it('unmarks a film that was watched', async () => {
    const onChange = vi.fn(async () => ok({ watched: false }));
    const { button } = renderToggle({ watched: true, onChange });

    button.click();

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ tmdbId: '313369', watched: false }),
    );
  });

  it('does not disable itself while the write is in flight', async () => {
    // Disabling moves focus off the control mid-interaction, and a second press
    // is harmless because the action states an end state rather than flipping.
    // Never settles: the point is the state *during* the write.
    const onChange: ChangeHandler = () => new Promise(() => {});
    const { button } = renderToggle({ onChange });

    button.click();

    await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('true'));
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('when the write fails', () => {
  it('reverts, rather than showing a check for a row that does not exist', async () => {
    const onChange = vi.fn(async () => ({
      ok: false as const,
      code: 'FORBIDDEN' as const,
      message: 'log in to mark films watched',
    }));
    const { button } = renderToggle({ onChange });

    button.click();

    await waitFor(() => expect(button.getAttribute('aria-pressed')).toBe('false'));
  });

  it('announces the reason, for somebody who cannot see it revert', async () => {
    const onChange = vi.fn(async () => ({
      ok: false as const,
      code: 'FORBIDDEN' as const,
      message: 'log in to mark films watched',
    }));
    renderToggle({ onChange });

    screen.getByRole('button').click();

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('log in to mark films watched'),
    );
  });
});

/**
 * 🔴 The defect this component shipped with: everything above is about a screen
 * reader, and a sighted reader got a bare glyph. These are the tests that go red
 * if the words come back off.
 */
describe('what a sighted reader sees', () => {
  it('says the action in words where there is room', () => {
    const { button } = renderToggle({ hint: 'label' });

    // The *visible* text, not the accessible name — `sr-only` text would pass a
    // name assertion and leave the reader looking at a bare glyph, which is
    // precisely the bug.
    expect(visibleText(button)).toBe('Mark as watched');
  });

  it('says "Watched" rather than the action once the film is marked', () => {
    const { button } = renderToggle({ hint: 'label', watched: true });

    expect(visibleText(button)).toBe('Watched');
  });

  it('carries a tooltip where a label would not fit', async () => {
    // `hint="tooltip"` is the poster-grid case. The popper is MUI's and only
    // exists once opened, so this asserts the wiring: the control is inside a
    // tooltip that describes it with the same words.
    const { button } = renderToggle({ hint: 'tooltip', title: 'Sinners' });

    fireEvent.mouseOver(button);

    await waitFor(() =>
      expect(screen.getByRole('tooltip').textContent).toBe('Mark as watched: Sinners'),
    );
  });

  it('shows one mechanism, never both', () => {
    // Two things saying the same thing on one control is clutter, and a native
    // `title` alongside MUI's tooltip would also give it a second description.
    const labelled = renderToggle({ hint: 'label' }).button;
    expect(labelled.getAttribute('title')).toBe(null);

    cleanup();

    const tipped = renderToggle({ hint: 'tooltip' }).button;
    expect(visibleText(tipped)).toBe('');
    expect(tipped.getAttribute('title')).toBe(null);
  });

  it('offers an eye, not a plus, for a film not yet watched', () => {
    // 🔴 D64: a row means "I have seen this". A `+` reads as "add to a list of
    // films to watch later" — the opposite — and the component's own docstring
    // insists no string says "add to watchlist". The icon was the one thing
    // still saying it.
    const { button } = renderToggle({ watched: false });
    const paths = [...button.querySelectorAll('path')].map((p) => p.getAttribute('d'));

    expect(paths).not.toContain('M12 5v14M5 12h14');
    expect(button.querySelector('circle')).toBeTruthy();
  });
});

describe('the visible label and the accessible name agree', () => {
  /**
   * 🔴 WCAG 2.5.3, Label in Name: a voice-control user says the words in front
   * of them, so the accessible name has to *contain* the visible ones. The old
   * name was "Mark La La Land as watched", which does not contain "Mark as
   * watched" — the film's title was wedged through the middle of it.
   */
  it.each([true, false])('in both states (watched: %s)', (watched) => {
    const { button } = renderToggle({ hint: 'label', watched, title: 'Sinners' });

    const name = button.getAttribute('aria-label') ?? '';
    expect(name).toContain(visibleText(button));
    // And the name still names the film, which is why it is longer.
    expect(name).toContain('Sinners');
  });

  it('is the same string the tooltip shows', async () => {
    const { button } = renderToggle({ hint: 'tooltip', title: 'Sinners' });

    fireEvent.mouseOver(button);

    await waitFor(() =>
      expect(screen.getByRole('tooltip').textContent).toBe(
        button.getAttribute('aria-label'),
      ),
    );
  });
});
