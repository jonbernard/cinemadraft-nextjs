import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { EventAdminDialog } from './EventAdminDialog';

const meta = {
  title: 'Admin/EventAdminDialog',
  component: EventAdminDialog,
  args: {
    event: {
      id: 1,
      name: 'Academy of Motion Picture Arts and Sciences',
      abbreviation: 'oscars',
      image: null,
      nomActive: false,
      nomDate: null,
      nomTime: null,
      nomDuration: null,
      awardsActive: false,
      awardsDate: null,
      awardsTime: null,
      awardsDuration: 10_800_000,
      liveResults: true,
    },
  },
} satisfies Meta<typeof EventAdminDialog>;

export default meta;

// Closed is how it arrives; press the button to see the form.
export const Closed: StoryObj<typeof meta> = {};
