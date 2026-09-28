import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';

import type { openSeason } from '@/actions/leagues/manage-league';
import { OpenSeasonButton, OpenSeasonPanel } from './OpenSeason';

const opens: typeof openSeason = async () => ({ ok: true, data: { opened: true } });
const refuses: typeof openSeason = async () => ({
  ok: false,
  code: 'CONFLICT',
  message: 'that season cannot be opened',
});

/**
 * Opening the next season (D131), in the shapes the league page shows it.
 * Both schemes come from the toolbar's global. `action` stands in for the
 * Server Action, which Storybook cannot call.
 */
const meta = {
  title: 'Leagues/OpenSeason',
  component: OpenSeasonPanel,
  args: {
    leagueId: 7,
    year: 2027,
    fromYear: 2026,
    action: opens,
  },
} satisfies Meta<typeof OpenSeasonPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The Seasons nav's last entry, as the owner sees it on 2026's page. */
export const ButtonInNav: Story = {
  name: 'Button',
  render: (args) => (
    <nav aria-label="Seasons" className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-text-secondary tabular font-mono underline">2025</span>
      <span className="text-accent-text tabular font-mono">2026</span>
      <OpenSeasonButton leagueId={args.leagueId} year={args.year} action={args.action} />
    </nav>
  ),
};

/** In place of the board, when the owner is looking at 2027 before opening it. */
export const PanelStory: Story = { name: 'Panel' };

/** The action refused: the reason is read out, and the page stays put. */
export const PanelError: Story = {
  args: {
    action: refuses,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open 2027' }));
    const dialog = within(canvasElement.ownerDocument.body).getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Open 2027' }));
    await expect(await canvas.findByText('that season cannot be opened')).toBeVisible();
  },
};
