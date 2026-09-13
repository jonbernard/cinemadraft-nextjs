import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { RatingInput } from './RatingInput';

const meta = {
  title: 'Phase 10/RatingInput',
  component: RatingInput,
  args: { name: 'rating', onChange: () => {} },
  render: function Controlled(args) {
    const [rating, setRating] = useState<number | null>(args.value);
    return <RatingInput {...args} value={rating} onChange={setRating} />;
  },
} satisfies Meta<typeof RatingInput>;

export default meta;

export const Unrated: StoryObj<typeof meta> = {
  args: { value: null },
};

export const HalfStar: StoryObj<typeof meta> = {
  args: { value: 3.5 },
};

/** While a save is in flight — the fieldset disables every step at once. */
export const Saving: StoryObj<typeof meta> = {
  args: { value: 5, disabled: true },
};
