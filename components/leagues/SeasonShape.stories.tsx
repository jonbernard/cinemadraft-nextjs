import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  SeasonBeat,
  type SeasonPhase,
  SeasonPhaseBeats,
  SeasonShape,
} from './SeasonShape';

const meta = {
  title: 'Phase 18/SeasonShape',
  component: SeasonShape,
} satisfies Meta<typeof SeasonShape>;

export default meta;

/**
 * Fixed instants, not offsets from `Date.now()`: a story computed from the
 * current clock changes what it shows every time the docs are rebuilt, and
 * "Next up" would eventually land on a different beat.
 */
function phases(): SeasonPhase[] {
  const show = (
    eventId: number,
    name: string,
    abbreviation: string,
    nominations: number | null,
    ceremony: number | null,
    complete: boolean,
  ): SeasonPhase[] => [
    {
      key: `${eventId}-nominations`,
      eventId,
      phase: 'nominations',
      name,
      abbreviation,
      date: nominations,
      complete,
    },
    {
      key: `${eventId}-ceremony`,
      eventId,
      phase: 'ceremony',
      name,
      abbreviation,
      date: ceremony,
      complete,
    },
  ];

  return [
    ...show(
      1,
      'Golden Globes',
      'globes',
      Date.UTC(2026, 0, 8),
      Date.UTC(2026, 0, 11),
      true,
    ),
    ...show(
      2,
      'Directors Guild Awards',
      'dga',
      Date.UTC(2026, 1, 3),
      Date.UTC(2026, 1, 7),
      false,
    ),
    ...show(
      3,
      'Academy Awards',
      'oscars',
      Date.UTC(2026, 1, 20),
      Date.UTC(2026, 2, 15),
      false,
    ),
    ...show(4, 'Golden Raspberry Awards', 'razzies', null, null, false),
  ];
}

export const FullSeason: StoryObj<typeof meta> = {
  args: {
    // `phases` feeds the span sentence above the rule and nothing else; the
    // beats come from `children`, because the page's beats are more than the
    // season's phases.
    phases: phases(),
    children: (
      <>
        <SeasonBeat label="Draft night" note="Before any of it" when="Your league picks">
          <p className="text-text-secondary max-w-prose text-sm">
            Every beat below can carry whatever the page wants to say at that point in the
            season — a worked example, the shows, two sentences of prose.
          </p>
        </SeasonBeat>
        <SeasonPhaseBeats
          phases={phases()}
          slots={{
            '3-ceremony': (
              <p className="text-text-secondary max-w-prose text-sm">
                A slot, keyed by the phase it belongs to.
              </p>
            ),
          }}
        />
      </>
    ),
  },
};

export const Unscheduled: StoryObj<typeof meta> = {
  name: 'A season nobody has dated yet',
  args: {
    // No dated phases, so there is no span to report and the sentence is absent
    // rather than reading "0 months".
    phases: phases().map((p) => ({ ...p, date: null })),
    children: (
      <SeasonPhaseBeats
        phases={phases().map((p) => ({ ...p, date: null, complete: false }))}
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every date says so in words. "Next up" falls back to the first ' +
          'incomplete phase when nothing ahead is scheduled.',
      },
    },
  },
};

export const Empty: StoryObj<typeof meta> = {
  name: 'A database with no events at all',
  args: { phases: [], children: <SeasonPhaseBeats phases={[]} /> },
  parameters: {
    docs: {
      description: {
        story:
          'What a signed-out reader on a fresh database sees. An empty ' +
          'vertical rule would read as a broken page, so the spine says what ' +
          'is missing instead.',
      },
    },
  },
};
