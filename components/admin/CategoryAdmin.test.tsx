import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CategoryAdmin } from '@/components/admin/CategoryAdmin';

const focusAward = vi.hoisted(() => vi.fn());
const attachNominee = vi.hoisted(() => vi.fn());
const filmPeopleAction = vi.hoisted(() => vi.fn());
const findFilmsAction = vi.hoisted(() => vi.fn());
const removeNominee = vi.hoisted(() => vi.fn());
const setWinner = vi.hoisted(() => vi.fn());
vi.mock('@/actions/awards/focus-award', () => ({ focusAward }));
vi.mock('@/actions/awards/attach-nominee', () => ({ attachNominee }));
vi.mock('@/actions/awards/film-people', () => ({ filmPeopleAction }));
vi.mock('@/actions/awards/delete-category', () => ({ deleteCategory: vi.fn() }));
vi.mock('@/actions/awards/remove-nominee', () => ({ removeNominee }));
vi.mock('@/actions/awards/set-winner', () => ({ setWinner }));
vi.mock('@/actions/search/find-films', () => ({ findFilmsAction }));

const PROPS = {
  awardId: 10,
  categoryName: 'Best Picture',
  year: 2026,
  nominees: [],
  requiresNomineeName: false,
};

/**
 * The ceremony pointer's control (P14.T12).
 *
 * 🔴 The state is carried in `aria-pressed` as well as in the label and the
 * colour. An admin running a show off a laptop on a sofa is the reader here,
 * and "which one is up" must not depend on telling carmine from a border.
 */
describe('CategoryAdmin — put on screen (Winners mode)', () => {
  beforeEach(() => {
    focusAward.mockReset();
    focusAward.mockResolvedValue({ ok: true, data: null });
  });

  it('offers to put the category up when nothing of it is on screen', () => {
    render(<CategoryAdmin {...PROPS} mode="winners" onScreen={false} />);

    const button = screen.getByRole('button', { name: 'Put on screen' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('says it is up, and is pressed, when it is the one on screen', () => {
    render(<CategoryAdmin {...PROPS} mode="winners" onScreen={true} />);

    const button = screen.getByRole('button', { name: 'On screen' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('puts it on screen', async () => {
    render(<CategoryAdmin {...PROPS} mode="winners" onScreen={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'Put on screen' }));

    expect(focusAward).toHaveBeenCalledWith({ awardId: 10, on: true });
  });

  it('takes it off again when it is already up', async () => {
    // Not a second control: the same button toggles, because there is one
    // selection per show and "nothing on screen" is a state between
    // announcements.
    render(<CategoryAdmin {...PROPS} mode="winners" onScreen={true} />);

    await userEvent.click(screen.getByRole('button', { name: 'On screen' }));

    expect(focusAward).toHaveBeenCalledWith({ awardId: 10, on: false });
  });

  it('shows the refusal rather than pretending the category went up', async () => {
    focusAward.mockResolvedValue({
      ok: false,
      code: 'FORBIDDEN',
      message: 'not an admin',
    });
    render(<CategoryAdmin {...PROPS} mode="winners" onScreen={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'Put on screen' }));

    expect(await screen.findByText('not an admin')).toBeInTheDocument();
  });
});

const OBAA = {
  id: 55,
  tmdbId: '1054867',
  title: 'One Battle After Another',
  year: 2025,
  posterUrl: null,
  isTaken: false,
  isLocal: true,
};

const CREDITS = [
  {
    id: 1121,
    name: 'Benicio del Toro',
    kind: 'cast',
    character: 'Sensei Sergio St. Carlos',
    jobs: null,
  },
  {
    id: 2228,
    name: 'Sean Penn',
    kind: 'cast',
    character: 'Col. Steven J. Lockjaw',
    jobs: null,
  },
  {
    id: 4762,
    name: 'Paul Thomas Anderson',
    kind: 'crew',
    character: null,
    jobs: 'Director',
  },
];

/** The two halves of the real pair: one film, two people, one of them the winner. */
const PAIR = [
  {
    nominationId: 1,
    movieId: 55,
    title: 'One Battle After Another',
    posterUrl: null,
    detailName: 'Benicio del Toro',
    detailCharacter: 'Sensei Sergio St. Carlos',
    detailId: 1121,
    isWinner: false,
  },
  {
    nominationId: 2,
    movieId: 55,
    title: 'One Battle After Another',
    posterUrl: null,
    detailName: 'Sean Penn',
    detailCharacter: 'Col. Steven J. Lockjaw',
    detailId: 2228,
    isWinner: true,
  },
];

async function chooseTheFilm() {
  await userEvent.type(screen.getByRole('searchbox'), 'one battle');
  await userEvent.click(
    await screen.findByRole('button', { name: /One Battle After Another\s*2025/ }),
  );
}

/**
 * Nominating is film first, then the person from that film's credits — the
 * source app's picker (§12), with no free-text fallback.
 */
describe('CategoryAdmin — nominating', () => {
  beforeEach(() => {
    attachNominee.mockReset();
    attachNominee.mockResolvedValue({ ok: true, data: { nominationId: 9 } });
    filmPeopleAction.mockReset();
    filmPeopleAction.mockResolvedValue({ ok: true, data: CREDITS });
    findFilmsAction.mockReset();
    findFilmsAction.mockResolvedValue({ ok: true, data: [OBAA] });
  });

  it('attaches a film straight away where the category names nobody', async () => {
    render(<CategoryAdmin {...PROPS} mode="nominations" onScreen={false} />);

    await chooseTheFilm();

    expect(attachNominee).toHaveBeenCalledWith({ awardId: 10, movieId: 55, year: 2026 });
    expect(filmPeopleAction).not.toHaveBeenCalled();
    expect(
      await screen.findByText('One Battle After Another nominated'),
    ).toBeInTheDocument();
  });

  it('where it names someone, loads the film’s credits instead, and offers no text field', async () => {
    render(
      <CategoryAdmin
        {...PROPS}
        mode="nominations"
        requiresNomineeName
        onScreen={false}
      />,
    );

    await chooseTheFilm();

    expect(filmPeopleAction).toHaveBeenCalledWith('1054867');
    expect(attachNominee).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /Sean Penn/ })).toBeInTheDocument();
    // The film search is gone and the only field is the picker's filter.
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
    expect(
      screen.getByRole('searchbox', { name: 'Person nominated' }),
    ).toBeInTheDocument();
  });

  it('attaches the person chosen, with their TMDB id and character', async () => {
    render(
      <CategoryAdmin
        {...PROPS}
        mode="nominations"
        requiresNomineeName
        onScreen={false}
      />,
    );
    await chooseTheFilm();

    await userEvent.type(
      await screen.findByRole('searchbox', { name: 'Person nominated' }),
      'penn',
    );
    await userEvent.click(screen.getByRole('button', { name: /Sean Penn/ }));

    expect(attachNominee).toHaveBeenCalledWith({
      awardId: 10,
      movieId: 55,
      year: 2026,
      detailName: 'Sean Penn',
      detailId: 2228,
      detailCharacter: 'Col. Steven J. Lockjaw',
    });
    expect(
      await screen.findByText('Sean Penn nominated for One Battle After Another'),
    ).toBeInTheDocument();
    // Back to the film search for the next name read out.
    expect(
      screen.getByRole('searchbox', { name: /Nominate a film/ }),
    ).toBeInTheDocument();
  });

  it('stores no character for a crew credit', async () => {
    render(
      <CategoryAdmin
        {...PROPS}
        mode="nominations"
        requiresNomineeName
        onScreen={false}
      />,
    );
    await chooseTheFilm();

    await userEvent.click(
      await screen.findByRole('button', { name: /Paul Thomas Anderson/ }),
    );

    expect(attachNominee).toHaveBeenCalledWith({
      awardId: 10,
      movieId: 55,
      year: 2026,
      detailName: 'Paul Thomas Anderson',
      detailId: 4762,
    });
  });

  it('marks a person already nominated for this film here, and will not attach them twice', async () => {
    render(
      <CategoryAdmin
        {...PROPS}
        mode="nominations"
        nominees={PAIR}
        requiresNomineeName
        onScreen={false}
      />,
    );
    await chooseTheFilm();

    const picker = await screen.findByRole('list', { name: 'Cast and crew' });
    // The list renders while the fetch's transition is still pending, and
    // every row is disabled until it settles (`busy`); under CI load the
    // assertions used to land in that window. Wait for the other person to
    // come free first, so Sean's being disabled is his own, not the busy one.
    await waitFor(() =>
      expect(
        within(picker).getByRole('button', { name: /Paul Thomas Anderson/ }),
      ).toBeEnabled(),
    );
    const sean = within(picker).getByRole('button', { name: /Sean Penn/ });
    expect(sean).toBeDisabled();
    expect(sean).toHaveTextContent('Nominated');
  });

  it('says so when TMDB does not answer, rather than showing an empty list', async () => {
    filmPeopleAction.mockResolvedValue({
      ok: false,
      code: 'NOT_FOUND',
      message: 'TMDB did not answer for that film — try again',
    });
    render(
      <CategoryAdmin
        {...PROPS}
        mode="nominations"
        requiresNomineeName
        onScreen={false}
      />,
    );

    await chooseTheFilm();

    expect(
      await screen.findByText('TMDB did not answer for that film — try again'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change film' })).toBeInTheDocument();
  });

  it('goes back to the film search on "Change film"', async () => {
    render(
      <CategoryAdmin
        {...PROPS}
        mode="nominations"
        requiresNomineeName
        onScreen={false}
      />,
    );
    await chooseTheFilm();

    await userEvent.click(await screen.findByRole('button', { name: 'Change film' }));

    expect(
      screen.getByRole('searchbox', { name: /Nominate a film/ }),
    ).toBeInTheDocument();
  });
});

/**
 * The controls on each poster, one job at a time. Winners mode marks and
 * clears; Nominations mode removes. The text list that repeated the nominees
 * under the form is gone, and the pair's two posters are told apart by the
 * person — on screen and in each control's accessible name.
 */
describe('CategoryAdmin — Winners mode', () => {
  beforeEach(() => {
    setWinner.mockReset();
    setWinner.mockResolvedValue({ ok: true, data: null });
  });

  function renderWinners() {
    return render(
      <CategoryAdmin {...PROPS} mode="winners" nominees={PAIR} onScreen={false} />,
    );
  }

  it('puts Mark or Clear winner on each poster, and nothing to remove or add', () => {
    renderWinners();

    const posters = screen.getAllByRole('listitem');
    expect(posters).toHaveLength(2);
    expect(
      within(posters[0] as HTMLElement).getByText('Benicio del Toro'),
    ).toBeInTheDocument();
    expect(
      within(posters[0] as HTMLElement).getByRole('button', { name: /Mark winner/ }),
    ).toBeInTheDocument();
    expect(
      within(posters[1] as HTMLElement).getByRole('button', { name: /Clear winner/ }),
    ).toBeInTheDocument();
    // 🔴 Not one poster-width from "Mark winner" on the night.
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete category' }),
    ).not.toBeInTheDocument();
    // The title appears once per poster — in the frame's caption — and nowhere else.
    expect(screen.getAllByText('One Battle After Another')).toHaveLength(2);
  });

  it('names who each control is for, so the pair are two different buttons', () => {
    renderWinners();

    expect(
      screen.getByRole('button', {
        name: 'Mark winner: Benicio del Toro, One Battle After Another',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Clear winner: Sean Penn, One Battle After Another',
      }),
    ).toBeInTheDocument();
  });

  it('marks the nomination clicked, and clears the one that already won', async () => {
    renderWinners();

    await userEvent.click(screen.getByRole('button', { name: /Mark winner: Benicio/ }));
    expect(setWinner).toHaveBeenLastCalledWith({
      awardId: 10,
      year: 2026,
      nominationId: 1,
    });

    await userEvent.click(screen.getByRole('button', { name: /Clear winner: Sean/ }));
    expect(setWinner).toHaveBeenLastCalledWith({
      awardId: 10,
      year: 2026,
      nominationId: null,
    });
  });
});

describe('CategoryAdmin — Nominations mode', () => {
  beforeEach(() => {
    removeNominee.mockReset();
    removeNominee.mockResolvedValue({ ok: true, data: null });
  });

  function renderNominations() {
    return render(
      <CategoryAdmin {...PROPS} mode="nominations" nominees={PAIR} onScreen={false} />,
    );
  }

  it('puts Remove on each poster, with the nominate field and Delete category, and no winner or screen controls', () => {
    renderNominations();

    for (const poster of screen.getAllByRole('listitem')) {
      expect(within(poster).getByRole('button', { name: /^Remove/ })).toBeInTheDocument();
    }
    expect(
      screen.getByRole('searchbox', { name: /Nominate a film/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete category' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /winner/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /on screen/i })).not.toBeInTheDocument();
  });

  it('asks before removing, and removes nothing on Cancel', async () => {
    renderNominations();

    await userEvent.click(screen.getByRole('button', { name: /Remove: Sean Penn/ }));
    const dialog = screen.getByRole('dialog');
    // The winner's removal says what else goes with it.
    expect(dialog).toHaveTextContent(
      'Remove Sean Penn, One Battle After Another from Best Picture? Its win goes with it.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(removeNominee).not.toHaveBeenCalled();
  });

  it('removes the nomination confirmed', async () => {
    renderNominations();

    await userEvent.click(screen.getByRole('button', { name: /Remove: Benicio/ }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }),
    );

    expect(removeNominee).toHaveBeenCalledWith(1);
  });
});
