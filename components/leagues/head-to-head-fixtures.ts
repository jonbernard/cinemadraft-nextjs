import { compareSeats, type H2HSeat, type HeadToHead } from '@/lib/services/head-to-head';
import { rankSeats } from '@/lib/utils/rank';

/**
 * League-1-shaped pairs for stories and component tests (P16.T24), built by
 * the real `compareSeats` so a fixture cannot say something the service would
 * not. Not a component module, so Biome lets it export data.
 */
const film = (
  movieId: number,
  title: string,
  points: number,
  round: number,
  won = false,
) => ({
  movieId,
  tmdbId: String(900_000 + movieId),
  title,
  posterUrl: null,
  round,
  points,
  ledger: points > 0 ? [{ won }] : [],
});

const SEATS: H2HSeat[] = [
  {
    draftId: 1,
    name: 'Micah Baird',
    uuid: 'micah',
    isDummy: false,
    group: 1,
    total: 835,
    picks: [
      film(1, 'Sinners', 265, 1, true),
      film(2, 'One Battle After Another', 150, 2, true),
      film(3, 'Hamnet', 190, 3, true),
      film(4, 'Marty Supreme', 120, 4),
      film(5, 'Frankenstein', 60, 5),
      film(6, 'Wicked: For Good', 40, 6),
      film(7, 'Jay Kelly', 10, 7),
    ],
  },
  {
    draftId: 2,
    name: 'James Kinney',
    uuid: 'james',
    isDummy: false,
    group: 2,
    total: 810,
    picks: [
      film(2, 'One Battle After Another', 150, 1, true),
      film(1, 'Sinners', 265, 2, true),
      film(8, 'Sentimental Value', 210, 3, true),
      film(9, 'Bugonia', 95, 4),
      film(10, 'Train Dreams', 55, 5),
      film(11, 'The Secret Agent', 25, 6),
      film(12, 'Avatar: Fire and Ash', 10, 7),
    ],
  },
  {
    draftId: 3,
    name: 'Hannibal Lecter',
    uuid: null,
    isDummy: true,
    group: 1,
    total: 505,
    picks: [
      film(13, 'Blue Moon', 180, 1),
      film(14, 'If I Had Legs I’d Kick You', 150, 2, true),
      film(15, 'Kokuho', 95, 3),
      film(16, 'F1', 80, 4),
    ],
  },
];

const STANDINGS = rankSeats(
  SEATS.map((seat) => ({ ...seat, userId: seat.isDummy ? null : seat.draftId })),
  2,
);

function pair(viewer: number | null, vs: number): HeadToHead {
  const h2h = compareSeats(SEATS, STANDINGS, viewer, vs);
  if (!h2h) throw new Error('fixture pair missing');
  return h2h;
}

/** James (reader) against Micah, across groups: 415 shared. */
export const CROSS_GROUP = pair(2, 1);
/** Micah against the character seat in his own group: nothing shared. */
export const SAME_GROUP = pair(null, 3);
/** A follower opens the leader's own row: the leader against second. */
export const LEADER = pair(null, 1);
