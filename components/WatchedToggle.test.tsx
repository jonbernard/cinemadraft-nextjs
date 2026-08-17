import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ActionResult } from '@/actions/result';
import { ok } from '@/actions/result';
import { WatchedToggle } from '@/components/WatchedToggle';

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

function renderToggle(
  options: { watched?: boolean; onChange?: ChangeHandler; title?: string } = {},
) {
  const onChange = options.onChange ?? vi.fn(async () => ok({ watched: true }));
  render(
    <WatchedToggle
      tmdbId="313369"
      title={options.title ?? 'La La Land'}
      watched={options.watched ?? false}
      onChange={onChange}
    />,
  );
  return { onChange, button: screen.getByRole('button') };
}

describe('what a screen reader hears', () => {
  it('🔴 names the film, so twenty badges on a grid are distinguishable', () => {
    renderToggle({ title: 'Sinners' });

    expect(screen.getByRole('button', { name: /Mark Sinners as watched/i })).toBeTruthy();
  });

  it('🔴 announces the state through aria-pressed, not the icon', () => {
    const { button } = renderToggle({ watched: true });

    // The source carried this in a plus-versus-check swap, so a screen reader
    // heard "button" in both states.
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent).toMatch(/watched/i);
  });

  it('says what pressing it will do when the film is already watched', () => {
    renderToggle({ watched: true });

    expect(screen.getByRole('button', { name: /Mark as not watched/i })).toBeTruthy();
  });
});

describe('the target', () => {
  it('🔴 is at least 44px, because it sits inside a poster that is also a link', () => {
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

describe('🔴 when the write fails', () => {
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
