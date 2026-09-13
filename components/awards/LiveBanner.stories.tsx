import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LiveBanner } from './LiveBanner';

const meta = {
  title: 'Live/LiveBanner',
  component: LiveBanner,
} satisfies Meta<typeof LiveBanner>;

export default meta;

/**
 * The only state there is. The banner does not render at all when nothing is
 * handing out awards — `DashboardView.liveNow` is null and the page skips it —
 * so an "off air" story would be a picture of something that never appears.
 */
export const OnAir: StoryObj<typeof meta> = {
  args: { abbreviation: 'oscars', name: 'Academy Awards', year: 2026 },
};
