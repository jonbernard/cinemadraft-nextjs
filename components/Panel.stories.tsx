import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Panel } from './Panel';
import { SectionHead } from './SectionHead';

const meta = {
  title: 'Existing/Panel',
  component: Panel,
} satisfies Meta<typeof Panel>;

export default meta;

export const Surface: StoryObj<typeof meta> = {
  args: {
    tone: 'surface',
    className: 'p-4',
    children: (
      <>
        <SectionHead eyebrow="Draft board" right="12 of 20">
          Round 3
        </SectionHead>
        <p className="text-text-dim text-sm">
          On the bg-bg-base ground behind it, this panel steps up in surface value alone —
          no hairline marks the edge.
        </p>
      </>
    ),
  },
};

export const Raised: StoryObj<typeof meta> = {
  args: {
    tone: 'raised',
    className: 'p-4',
    children: (
      <>
        <SectionHead eyebrow="Draft board" right="12 of 20">
          Round 3
        </SectionHead>
        <p className="text-text-dim text-sm">
          `bg-bg-raised` steps up again from `bg-bg-surface`, for a panel that floats
          above another panel rather than the base ground.
        </p>
      </>
    ),
  },
};
