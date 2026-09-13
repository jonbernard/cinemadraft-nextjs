import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Pagination } from './Pagination';

const meta = {
  title: 'Watchlist/Pagination',
  component: Pagination,
  args: { basePath: '/watchlist', params: { view: 'films' } },
} satisfies Meta<typeof Pagination>;

export default meta;

export const FirstPage: StoryObj<typeof meta> = {
  args: { page: 1, pageCount: 11 },
};

export const MidList: StoryObj<typeof meta> = {
  args: { page: 6, pageCount: 11 },
};

export const LastPage: StoryObj<typeof meta> = {
  args: { page: 11, pageCount: 11 },
};

/** Two pages need no gaps, and nothing is elided. */
export const Short: StoryObj<typeof meta> = {
  args: { page: 1, pageCount: 2 },
};
