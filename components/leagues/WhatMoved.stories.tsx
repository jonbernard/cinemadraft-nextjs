import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { KEEPS_LEAD, LIVE, TAKES_LEAD, UNDATED_PAST } from './standings-fixtures';
import { WhatMoved } from './WhatMoved';

/** The league at its latest moment (P16.T19). Both schemes come from the toolbar. */
const meta = {
  title: 'Leagues/WhatMoved',
  component: WhatMoved,
  args: { moved: KEEPS_LEAD, year: 2026 },
} satisfies Meta<typeof WhatMoved>;

export default meta;

type Story = StoryObj<typeof meta>;

export const KeepsLead: Story = {};

export const TakesLead: Story = { args: { moved: TAKES_LEAD } };

/** During a ceremony: "live · 14 of 24 decided". */
export const Live: Story = { args: { moved: LIVE } };

/** A season before stored dates: the moment says its year. */
export const UndatedPastSeason: Story = { args: { moved: UNDATED_PAST, year: 2025 } };
