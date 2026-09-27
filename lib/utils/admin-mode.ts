/**
 * The three jobs an award show page does for an admin (§12), and which one a
 * request is asking for.
 *
 * The source app's award show page had the same three, as a segmented control
 * only admins saw — View, Nominations, Pick Winners — at
 * `/award-shows/:abbr/:view` (`panelEvent.js`, `list.js`). Each kept the other
 * jobs' controls out of the way: Nominations was the only place a nominee could
 * be added or removed, Pick Winners the only place a winner could be marked or
 * a category sent to the live screen, and View was what every reader saw.
 */
export const ADMIN_MODES = ['view', 'nominations', 'winners'] as const;

export type AdminMode = (typeof ADMIN_MODES)[number];

/**
 * The mode for this request.
 *
 * 🔴 **`?mode=` is honoured for an admin only.** Everyone else is always in
 * View, whatever the URL says. The source read `:view` from the path without
 * asking who was reading, so a member who typed `/nominations` got the
 * remove-on-click overlays (the endpoints behind them were open too —
 * `PARITY.md` bug 1).
 *
 * With no `?mode=`, an admin lands in **Winners while the show is on air** and
 * in View otherwise: during a ceremony the page is opened to mark winners —
 * from the dashboard's live banner, from a bookmark, from a reload after the
 * laptop slept — and landing anywhere else is a wasted tap at the one moment
 * speed matters. An explicit `?mode=view` still means View, on air or not.
 */
export function resolveAdminMode(
  requested: string | undefined,
  { isAdmin, onAir }: { isAdmin: boolean; onAir: boolean },
): AdminMode {
  if (!isAdmin) return 'view';
  if ((ADMIN_MODES as readonly string[]).includes(requested ?? '')) {
    return requested as AdminMode;
  }
  return onAir ? 'winners' : 'view';
}
