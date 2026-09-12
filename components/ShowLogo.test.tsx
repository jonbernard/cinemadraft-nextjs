import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// 🔴 Forwards `width`, `height` and `className` as well as `src`/`alt`. The
// narrower stand-in dropped them, which made every size or plate assertion
// below unfalsifiable — the element simply never carried the attribute.
vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, className }: Record<string, unknown>) => (
    // biome-ignore lint/performance/noImgElement: this is the stand-in for next/image inside the test
    <img
      src={src as string}
      alt={alt as string}
      width={width as number}
      height={height as number}
      className={className as string}
      data-testid="image"
    />
  ),
}));

const { ShowLogo } = await import('./ShowLogo');

describe('ShowLogo', () => {
  it('renders the logo when there is one', () => {
    render(
      <ShowLogo imageUrl="https://x.public.blob.vercel-storage.com/award-shows/oscars.jpg" />,
    );
    expect(screen.getByTestId('image')).toHaveAttribute(
      'src',
      'https://x.public.blob.vercel-storage.com/award-shows/oscars.jpg',
    );
  });

  // 🔴 The show's name is beside the logo in every placement, so the logo is
  // decorative and must not repeat it to a screen reader.
  it('gives the logo empty alt text', () => {
    render(<ShowLogo imageUrl="https://x.public.blob.vercel-storage.com/a.jpg" />);
    expect(screen.getByTestId('image')).toHaveAttribute('alt', '');
  });

  it('🔴 renders the mark at 64px or larger', () => {
    // Twelve award bodies are the app's primary vocabulary. At 40px a wordmark
    // logo is not identifiable, which makes the page that teaches them useless.
    render(<ShowLogo imageUrl="https://x.public.blob.vercel-storage.com/a.jpg" />);
    const mark = screen.getByTestId('image');
    expect(Number(mark.getAttribute('width'))).toBeGreaterThanOrEqual(64);
    expect(Number(mark.getAttribute('height'))).toBeGreaterThanOrEqual(64);
  });

  it('🔴 puts the mark on a plate that does not follow the scheme', () => {
    // The marks are dark-on-transparent. bg-raised is near-black in dark and
    // near-parchment in light, so one of the two schemes renders them dark on
    // dark whatever value it takes.
    // A plate that inverts with the theme is the defect, whatever its value.
    render(<ShowLogo imageUrl="https://x.public.blob.vercel-storage.com/a.jpg" />);
    const classes = screen.getByTestId('image').className;
    expect(classes).toContain('bg-white');
    expect(classes).not.toMatch(/\b(dark|light):bg-/);
    // The mark is letterboxed onto the plate, never cropped to it.
    expect(classes).toContain('object-contain');
  });

  // events.image is nullable, and a Blob URL that 404s degrades to the same
  // place: nothing rendered, no empty frame, no broken-image icon.
  it('renders nothing when there is no logo', () => {
    const { container } = render(<ShowLogo imageUrl={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
