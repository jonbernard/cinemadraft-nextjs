import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { GroupCeremony } from './GroupCeremony';

/**
 * The group draw as a full-screen takeover.
 *
 * Unlike `SearchOverlay`'s story this one does open through `showModal()`,
 * because the component calls it on mount and there is nothing to look at
 * before it does: the dialog is the whole story. It renders into Storybook's
 * own iframe top layer, which is what makes it reviewable at all.
 *
 * 🔴 The groups here are a fixture, and that is the honest shape of the
 * component: in the app they are the assignments `randomiseGroups` has already
 * saved (P15.T12). Nothing in this file could roll a different draw, because
 * the component has no randomness in it.
 *
 * `Dealt` is league 1's real size — four groups of four — which is the case
 * worth reviewing: the reel runs 1.6s and then four groups land half a second
 * apart, so the whole thing is about 3.6s. `Instant` is the same information
 * with `reducedMotion`, which is what a reader who asked for less motion gets:
 * no reel, no confetti, the listing at once.
 */
const meta = {
  title: 'Existing/GroupCeremony',
  component: GroupCeremony,
  parameters: { layout: 'fullscreen' },
  args: {
    onDone: () => {},
    groups: [
      { group: 1, names: ['Ada', 'Katherine', 'Grace', 'Margaret'] },
      { group: 2, names: ['Dorothy', 'Mary', 'Annie', 'Evelyn'] },
      { group: 3, names: ['Hedy', 'Jean', 'Frances', 'Betty'] },
      { group: 4, names: ['Ruth', 'Marlyn', 'Kathleen', 'Adele'] },
    ],
  },
} satisfies Meta<typeof GroupCeremony>;

export default meta;

export const Dealt: StoryObj<typeof meta> = {};

export const Instant: StoryObj<typeof meta> = {
  args: { reducedMotion: true },
};
