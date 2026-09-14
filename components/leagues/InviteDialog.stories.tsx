import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { InviteDialog } from './InviteDialog';

const meta = {
  title: 'Components/InviteDialog',
  component: InviteDialog,
  args: {
    // A made-up uuid, never a real league's — this is the join credential.
    url: 'https://cinemadraft.com/join/2f1c6d4e-0000-4000-8000-000000000000',
  },
} satisfies Meta<typeof InviteDialog>;

export default meta;

export const Closed: StoryObj<typeof meta> = {
  name: 'Closed, which is how it arrives',
};
