import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { TopBar } from './TopBar';

const meta = {
  title: 'Existing/TopBar',
  component: TopBar,
} satisfies Meta<typeof TopBar>;

export default meta;

/**
 * The bar as a tablet sees it. It takes no props: it is one row holding one
 * link, and every variation it has is a breakpoint rather than a state.
 */
export const Default: StoryObj<typeof meta> = {};

/**
 * 390px — the width the bar exists for (P14.T16).
 *
 * Below `sm` the bottom bar's chrome group is hidden, so before this the
 * application carried no wordmark at all on a phone. `TabBar`'s own story at
 * this width is the other half of the picture: five tab slots of 78px with no
 * slack, which is why the mark could not simply be un-hidden down there.
 */
export const Phone: StoryObj<typeof meta> = {
  globals: {
    viewport: { value: 'mobile1' },
  },
};
