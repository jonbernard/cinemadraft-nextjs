import { ErrorPanel } from '@/components/ErrorPanel';

/**
 * Reached by `notFound()` and by any unmatched URL.
 *
 * Several pages call `notFound()` deliberately rather than showing an empty
 * shell — a league that does not exist, an award show that does not, and the
 * draft console when the viewer is not an owner. That last one answers 404
 * rather than 403 on purpose, so this page is also what a stranger sees when
 * they guess at `/leagues/1/draft`: it must not hint that anything is there.
 */
export default function NotFound() {
  return <ErrorPanel kind="not-found" />;
}
