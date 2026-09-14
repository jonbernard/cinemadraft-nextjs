import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ConfirmDialog, useConfirm } from './ConfirmDialog';

const meta = {
  title: 'Components/ConfirmDialog',
  component: ConfirmDialog,
  args: { onSettle: () => {} },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;

export const Closed: StoryObj<typeof meta> = {
  name: 'Closed, which renders nothing at all',
  args: { request: null },
};

export const Destructive: StoryObj<typeof meta> = {
  name: 'Open, with the act named on the button',
  args: {
    request: {
      message: 'Remove Grace from this league?',
      confirmLabel: 'Remove',
    },
  },
};

export const Long: StoryObj<typeof meta> = {
  name: 'The longest message in the app',
  args: {
    request: {
      // `/admin/season`, verbatim — the one that re-scopes every page for
      // every member, and the reason the dialog wraps rather than truncates.
      message:
        'Make 2025 the active season? This re-scopes every league, draft, award show ' +
        'and dashboard in the app for all 60 people, immediately. It takes effect ' +
        'with no redeploy and cannot be undone — only replaced by activating another ' +
        'season.',
      confirmLabel: 'Make 2025 active',
    },
  },
};

/** The shape every call site uses: a button, a `useConfirm()`, an await. */
export const ThroughTheHook: StoryObj<typeof meta> = {
  name: 'Through useConfirm, as a call site has it',
  // The hook owns the state, so the component's own args are unused here.
  args: { request: null },
  render: function ThroughTheHookStory() {
    const { confirm, dialog } = useConfirm();
    return (
      <>
        {dialog}
        <button
          type="button"
          onClick={async () => {
            const ok = await confirm(
              'Finish the draft? The league will be told it is over.',
              'Finish the draft',
            );
            // biome-ignore lint/suspicious/noConsole: a story is the place to see the answer.
            console.log('confirmed:', ok);
          }}
          className="bg-accent-fill min-h-11 rounded-sm px-4 text-sm text-white"
        >
          Finish the draft
        </button>
      </>
    );
  },
};
