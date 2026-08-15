/**
 * Move one item of a list to another position, returning a new list.
 *
 * Its own function, and tested directly, because it is the whole meaning of a
 * drag: everything else in the reorder path is presentation or a round trip.
 * An off-by-one here shows up as a pick that lands one round from where it was
 * dropped, which is the kind of thing that looks like a rendering glitch and
 * is actually a wrong draft.
 *
 * Out-of-range indices return the list unchanged rather than throwing or
 * splicing at the end — a drag can be cancelled or dropped outside the list,
 * and a cancelled drag must not reorder anything.
 */
export function reorder<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to) return [...items];
  if (from < 0 || from >= items.length) return [...items];
  if (to < 0 || to >= items.length) return [...items];

  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return [...items];
  next.splice(to, 0, moved);
  return next;
}
