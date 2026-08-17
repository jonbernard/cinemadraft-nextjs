import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PosterFrame } from './PosterFrame';

const meta = {
  title: 'Existing/PosterFrame',
  component: PosterFrame,
  args: {
    title: 'Everything Everywhere All at Once',
    // No remote poster host is allowlisted yet (Phase 5), so this exercises
    // the no-artwork fallback rather than pointing at a URL that would 404.
    posterUrl: null,
    round: 1,
    points: 87,
    share: 0.62,
    status: 'won',
  },
} satisfies Meta<typeof PosterFrame>;

export default meta;

export const Default: StoryObj<typeof meta> = {};
