import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PosterCarousel } from '@/components/PosterCarousel';

/**
 * 🔴 **jsdom has no layout and no scrolling.** `clientWidth` is 0, `scrollLeft`
 * never moves, and `scrollIntoView` does not exist until it is stubbed. So the
 * assertions here are about the *wiring* — that the buttons ask the right element
 * to scroll, that the counter reflects the scroll position it is given, and that
 * the keyboard can reach the strip. Whether a poster actually slides is an E2E
 * question, in a real browser, and pretending otherwise here would be a test of
 * a fake.
 *
 * This is the same split the nav drawer took: jsdom implements `<dialog>` but
 * not its focus trap, so that behaviour is asserted in Playwright.
 */
const POSTERS = ['/a.jpg', '/b.jpg', '/c.jpg'];

function renderCarousel() {
  const scrollIntoView = vi.fn();
  // Not present in jsdom at all. Stubbed on the prototype rather than faked per
  // element, so the component reaches it the way it would in a browser.
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(scrollIntoView);
  const view = render(<PosterCarousel title="La La Land" posterUrls={POSTERS} />);
  return { ...view, scrollIntoView };
}

describe('what it renders', () => {
  it('shows every poster, with the film in each alt text', () => {
    renderCarousel();

    expect(screen.getByAltText('Poster 1 for La La Land')).toBeTruthy();
    expect(screen.getByAltText('Poster 3 for La La Land')).toBeTruthy();
  });

  it('shows the counter the source page shows', () => {
    renderCarousel();

    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('🔴 reserves each poster’s aspect ratio, so the strip does not reflow', () => {
    // Core Web Vitals: CLS. Without it the row jumps as each image arrives.
    renderCarousel();

    expect(screen.getByAltText('Poster 1 for La La Land').className).toContain(
      'aspect-[2/3]',
    );
  });

  it('loads the first poster eagerly and the rest lazily', () => {
    renderCarousel();

    expect(screen.getByAltText('Poster 1 for La La Land').getAttribute('loading')).toBe(
      'eager',
    );
    expect(screen.getByAltText('Poster 2 for La La Land').getAttribute('loading')).toBe(
      'lazy',
    );
  });
});

describe('🔴 the keyboard path', () => {
  it('makes the scroll container focusable and named', () => {
    // WCAG 2.1.1: a scrollable region has to be reachable by keyboard, and only a
    // focusable element can be scrolled with the arrow keys. Biome's rule wanted
    // this tabIndex removed, which would have deleted the keyboard path silently
    // — so it is asserted here.
    renderCarousel();
    const region = screen.getByRole('region', { name: 'Posters for La La Land' });

    expect(region.getAttribute('tabIndex')).toBe('0');
  });

  it('keeps the posters in a list inside the region', () => {
    renderCarousel();

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});

describe('the buttons', () => {
  it('names both directions for a screen reader', () => {
    renderCarousel();

    expect(screen.getByRole('button', { name: 'Previous poster' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next poster' })).toBeTruthy();
  });

  it('disables previous on the first poster', () => {
    renderCarousel();

    expect(
      (screen.getByRole('button', { name: 'Previous poster' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('asks the browser to scroll rather than animating in JS', () => {
    // Which is what makes `prefers-reduced-motion` the platform's job instead of
    // a check this component could forget.
    const { scrollIntoView } = renderCarousel();

    fireEvent.click(screen.getByRole('button', { name: 'Next poster' }));

    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth', inline: 'start' }),
    );
  });

  it('meets the 44px target', () => {
    renderCarousel();
    const next = screen.getByRole('button', { name: 'Next poster' });

    expect(next.className).toContain('min-h-11');
    expect(next.className).toContain('min-w-11');
  });
});

describe('the counter follows the scroll position, not the button presses', () => {
  it('🔴 updates from a scroll the buttons did not cause', () => {
    // The strip can also be moved by swipe, trackpad and arrow keys. A counter
    // that only knew about button presses would drift out of step with what the
    // reader is looking at, which is worse than no counter.
    renderCarousel();
    const region = screen.getByRole('region', { name: 'Posters for La La Land' });

    // jsdom reports 0 for both, so the values are supplied directly — this is
    // faking *where things are*, which jsdom has no opinion about, and faking
    // nothing about what the component does with it.
    Object.defineProperty(region, 'clientWidth', { value: 100, configurable: true });
    region.scrollLeft = 200;
    fireEvent.scroll(region);

    expect(screen.getByText('3/3')).toBeTruthy();
  });
});

describe('a film with no posters', () => {
  it('renders nothing rather than an empty strip and a 1/0 counter', () => {
    const { container } = render(<PosterCarousel title="Untitled" posterUrls={[]} />);

    expect(container.textContent).toBe('');
  });
});
