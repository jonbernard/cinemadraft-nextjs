import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AdminModeSwitch } from './AdminModeSwitch';

const HREFS = {
  view: '?mode=view',
  nominations: '?mode=nominations',
  winners: '?mode=winners',
};

const meta = {
  title: 'Admin/AdminModeSwitch',
  component: AdminModeSwitch,
  args: { mode: 'view', hrefs: HREFS },
} satisfies Meta<typeof AdminModeSwitch>;

export default meta;

// What a reader sees — the default when the show is off air.
export const ViewMode: StoryObj<typeof meta> = {};

export const NominationsMode: StoryObj<typeof meta> = {
  args: { mode: 'nominations' },
};

// The default while the show is on air.
export const WinnersMode: StoryObj<typeof meta> = {
  args: { mode: 'winners' },
};
