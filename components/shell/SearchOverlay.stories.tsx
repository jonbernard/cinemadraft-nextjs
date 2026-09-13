import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SearchOverlay } from './SearchOverlay';

/**
 * Rendered with `open` rather than through `showModal()`, for the reason
 * `MoreSheet`'s story gives: the top layer competes with Storybook's own
 * iframe, and a story needs something to look at rather than a real modal.
 *
 * The search itself hits the live Server Action, so results only appear where
 * Storybook is running against a database. The empty panel is the state worth
 * reviewing here anyway — it is what every reader sees for the first keystroke.
 */
const meta = {
  title: 'Existing/SearchOverlay',
  component: SearchOverlay,
  args: { id: 'search', open: true },
} satisfies Meta<typeof SearchOverlay>;

export default meta;

export const Open: StoryObj<typeof meta> = {};
