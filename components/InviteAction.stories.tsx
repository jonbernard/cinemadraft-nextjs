import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { InviteAction } from './InviteAction';

const meta = {
  title: 'Components/InviteAction',
  component: InviteAction,
  args: {
    url: 'https://cinemadraft.com/join/2f1c6d4e-0000-4000-8000-000000000000',
  },
} satisfies Meta<typeof InviteAction>;

export default meta;

export const Closed: StoryObj<typeof meta> = {
  name: 'Closed, which is how it arrives',
};

export const AtPhoneWidth: StoryObj<typeof meta> = {
  name: 'At phone width',
  render: (args) => (
    <div style={{ maxWidth: 390 }}>
      <InviteAction {...args} />
    </div>
  ),
};
