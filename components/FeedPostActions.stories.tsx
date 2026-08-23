import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { type DeleteFeedItem, FeedPostActions } from './FeedPostActions';

const accept: DeleteFeedItem = async () => ({ ok: true, data: null });

const refuse: DeleteFeedItem = async () => ({
  ok: false,
  code: 'NOT_FOUND',
  message: 'that post is not there',
});

const meta = {
  title: 'Phase 10/FeedPostActions',
  component: FeedPostActions,
  args: { id: 90, label: 'December 4, 2023', onDelete: accept },
} satisfies Meta<typeof FeedPostActions>;

export default meta;

export const Ready: StoryObj<typeof meta> = {};

/** The row went before the button was pressed — two tabs, one post. */
export const Refused: StoryObj<typeof meta> = {
  args: { onDelete: refuse },
};
