import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SeasonPicker } from './SeasonPicker';

const meta = {
  title: 'Existing/SeasonPicker',
  component: SeasonPicker,
  args: { year: 2026, seasons: [2026, 2025] },
} satisfies Meta<typeof SeasonPicker>;

export default meta;

/**
 * 🔴 The case that produced the defect: ten seasons as a flat row of links was
 * ten targets measured at 33.6 × 20px. Open the control and every year is a
 * 44px row.
 */
export const TenSeasons: StoryObj<typeof meta> = {
  args: { seasons: [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017] },
};

/** The smallest real choice. */
export const TwoSeasons: StoryObj<typeof meta> = {};

/** One season is not a choice, so the control renders nothing at all. */
export const OneSeason: StoryObj<typeof meta> = {
  args: { seasons: [2026] },
};
