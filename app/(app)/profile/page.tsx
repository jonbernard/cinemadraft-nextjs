import { redirect } from 'next/navigation';

import { requirePageUser } from '@/lib/auth';

/**
 * Your own profile, at a URL you can type.
 *
 * 🔴 **A redirect rather than a page, because the nav is static data.**
 * `lib/nav/links.ts` is a plain list read by `NavRail`, `TabBar`, `MoreSheet`
 * and their tests; a profile entry needs the reader's own uuid, which that list
 * cannot know. Threading the uuid through the shell would make the link list
 * stop being data and start being a component concern — so the stable URL lives
 * here and resolves itself.
 *
 * 🔴 **It was unreachable before this.** `/members/[uuid]` is linked only from
 * seat names on a draft board (`DraftBoard.tsx:46`,
 * `LeagueBoardRoom.tsx:291`), so a member could reach everyone else's profile
 * and not their own — and `test/route-protection.ts` calls the league page "the
 * member index", which was true for everybody except the reader. Found when the
 * league-completion feed post was built and there was nowhere to go and see it.
 *
 * `requirePageUser`, not `requireUser`: signed out, this is a redirect to the
 * sign-in form, not a 500 (P12.T5 learned that the hard way on `/leagues/new`).
 */
export default async function ProfilePage() {
  const user = await requirePageUser();

  // A user row with no uuid cannot have a profile page — `profile_feeds` is
  // keyed by uuid and `/members/[uuid]` resolves by it. Nothing in the restored
  // data is missing one, but the column is nullable, so this answers rather
  // than building a URL ending in "undefined".
  if (!user.uuid) redirect('/');

  redirect(`/members/${user.uuid}`);
}
