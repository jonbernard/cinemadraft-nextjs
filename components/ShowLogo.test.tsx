import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // biome-ignore lint/performance/noImgElement: this is the stand-in for next/image inside the test
    <img src={src} alt={alt} data-testid="image" />
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

  // events.image is nullable, and a Blob URL that 404s degrades to the same
  // place: nothing rendered, no empty frame, no broken-image icon.
  it('renders nothing when there is no logo', () => {
    const { container } = render(<ShowLogo imageUrl={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
