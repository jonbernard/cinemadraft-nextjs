import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, useRef } from 'react';

import { MoreSheet } from './MoreSheet';

const meta = {
  title: 'Existing/MoreSheet',
  component: MoreSheet,
  args: {
    id: 'more',
    pathname: '/',
    isSignedIn: false,
  },
  /**
   * `showModal()` renders the dialog in the top layer, which Storybook's own
   * iframe would then have to compete with — so the story sets the `open`
   * attribute directly instead. That paints the sheet's contents in place
   * without the browser's modal machinery, which is exactly what a story
   * needs: something to look at, not something to interact with as a real
   * dialog. Task 17's Playwright suite is where `showModal()` itself gets
   * exercised.
   */
  render: (args) => {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
      ref.current?.setAttribute('open', '');
    }, []);
    return <MoreSheet {...args} ref={ref} />;
  },
} satisfies Meta<typeof MoreSheet>;

export default meta;

// 🔴 No `SignedIn` story: `UserButton` throws outside a `<ClerkProvider>`,
// and Storybook's preview has none — the same reason `AppNav`, which renders
// the same component, has no story of its own. `isSignedIn` is exercised in
// `MoreSheet.test.tsx`, where `@clerk/nextjs` is mocked.
export const SignedOut: StoryObj<typeof meta> = {
  args: {
    isSignedIn: false,
  },
};
