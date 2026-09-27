import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { TopBar } from './TopBar';

const meta = {
  title: 'Existing/TopBar',
  component: TopBar,
  args: {
    isSignedIn: false,
    onSearch: () => {},
    searchId: 'search',
  },
} satisfies Meta<typeof TopBar>;

export default meta;

/**
 * The bar as a tablet sees it: the wordmark on the left, search and the way in
 * on the right (D127).
 */
export const Default: StoryObj<typeof meta> = {};

/**
 * 390px — the width the bar exists for (P14.T16).
 *
 * The lockup and two 44px squares, with room to spare between them. The
 * bottom bar below this could not hold the two squares — five tab slots of
 * 78px with no slack — which is why they lived in the More sheet on a phone
 * until the owner moved them up here.
 *
 * 🔴 No signed-in story: `AccountControl` renders Clerk's `UserButton` when a
 * publishable key is present, and that throws outside a `<ClerkProvider>` —
 * the same reason `AppShell.stories.tsx` has none. `TopBar.test.tsx` covers the
 * signed-in shape, with the key stubbed away.
 */
export const Phone: StoryObj<typeof meta> = {
  globals: {
    viewport: { value: 'mobile1' },
  },
};
