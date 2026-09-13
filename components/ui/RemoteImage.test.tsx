import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    unoptimized,
  }: {
    src: string;
    alt: string;
    unoptimized?: boolean;
  }) => (
    // biome-ignore lint/performance/noImgElement: this is the stand-in for next/image inside the test
    <img src={src} alt={alt} data-testid="image" data-unoptimized={String(unoptimized)} />
  ),
}));

const { RemoteImage } = await import('./RemoteImage');

describe('RemoteImage', () => {
  it('passes TMDB artwork through unoptimized', () => {
    render(
      <RemoteImage
        src="https://image.tmdb.org/t/p/w500/abc.jpg"
        alt=""
        width={92}
        height={138}
      />,
    );
    expect(screen.getByTestId('image')).toHaveAttribute('data-unoptimized', 'true');
  });

  it('optimizes everything else', () => {
    render(
      <RemoteImage
        src="https://example.public.blob.vercel-storage.com/award-shows/sag.jpg"
        alt=""
        width={92}
        height={92}
      />,
    );
    expect(screen.getByTestId('image')).toHaveAttribute('data-unoptimized', 'false');
  });

  it('keeps the alt text it is given', () => {
    render(
      <RemoteImage
        src="https://img.clerk.com/abc"
        alt="Ada Lovelace"
        width={56}
        height={56}
      />,
    );
    expect(screen.getByAltText('Ada Lovelace')).toBeInTheDocument();
  });
});
