import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { FeedComposer, type PostFeedItem } from './FeedComposer';

const accept: PostFeedItem = async () => ({ ok: true, data: null });

const refuse: PostFeedItem = async () => ({
  ok: false,
  code: 'FORBIDDEN',
  message: 'this account has no profile yet',
});

const meta = {
  title: 'Phase 10/FeedComposer',
  component: FeedComposer,
  args: { onPost: accept },
} satisfies Meta<typeof FeedComposer>;

export default meta;

export const Empty: StoryObj<typeof meta> = {};

export const Refused: StoryObj<typeof meta> = {
  args: { onPost: refuse },
};
