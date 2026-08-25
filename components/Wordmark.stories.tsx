import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Wordmark } from './Wordmark';

const meta = {
  title: 'Existing/Wordmark',
  component: Wordmark,
} satisfies Meta<typeof Wordmark>;

export default meta;

/** The rail and the strip: 26px mark, 20px name. */
export const Small: StoryObj<typeof meta> = {
  args: { size: 'sm' },
};

/** A page header or an OG card. */
export const Medium: StoryObj<typeof meta> = {
  args: { size: 'md' },
};

/** A square slot — an avatar, a share sheet, a favicon preview. */
export const MarkOnly: StoryObj<typeof meta> = {
  args: { markOnly: true, size: 'md' },
};

/** On the app's raised surface, which is where the rail actually puts it. */
export const InTheRail: StoryObj<typeof meta> = {
  args: { size: 'sm' },
  render: (args) => (
    <div className="bg-bg-surface flex w-[208px] items-center rounded-md p-3">
      <Wordmark {...args} />
    </div>
  ),
};
