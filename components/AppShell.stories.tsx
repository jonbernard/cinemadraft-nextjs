import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AppShell } from './AppShell';

/**
 * 🔴 No signed-in story: `UserButton` throws outside a `<ClerkProvider>`, and
 * Storybook's preview has none — the same reason `MoreSheet`'s own stories
 * (and, before it, `AppNav`) carry no signed-in variant. `isSignedIn` is
 * exercised in `AppShell.test.tsx`, where `@clerk/nextjs` is mocked.
 *
 * `usePathname()` lives inside `AppShell` itself (one router read for the
 * whole shell, per Task 16), so these stories set it through
 * `@storybook/nextjs-vite`'s built-in App Router mock rather than a prop —
 * unlike `NavRail`/`TabBar`/`MoreSheet`, which take `pathname` directly for
 * exactly this reason.
 */
const meta = {
  title: 'Existing/AppShell',
  component: AppShell,
  args: {
    isSignedIn: false,
    children: <p>Page content goes here.</p>,
  },
  parameters: {
    nextjs: { navigation: { pathname: '/' } },
    // The shell fills the viewport by design (D67); Storybook's default
    // padded canvas would double the inset the shell already applies.
    layout: 'fullscreen',
  },
} satisfies Meta<typeof AppShell>;

export default meta;

export const Home: StoryObj<typeof meta> = {
  parameters: {
    nextjs: { navigation: { pathname: '/' } },
  },
};

export const InsideALeague: StoryObj<typeof meta> = {
  parameters: {
    nextjs: { navigation: { pathname: '/leagues/1' } },
  },
};
