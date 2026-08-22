import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { JoinLeagueButton } from '@/components/JoinLeagueButton';
import { SectionHead } from '@/components/SectionHead';
import { getCurrentUser } from '@/lib/auth';
import { draftRepository } from '@/lib/repositories/drafts';
import { leagueRepository } from '@/lib/repositories/leagues';

/**
 * Following an invite link (P10.T1).
 *
 * 🔴 **The page names the league and waits; it does not join on load.** Two
 * reasons, and the second only became obvious after the first: Next rejects a
 * mutation during render outright, and joining on load would mean anything
 * *fetching* the URL joins — a Slack unfurl, an iMessage preview, a crawler,
 * a prefetch. Pasting an invite into a group chat would have seated the
 * sender before anyone clicked.
 *
 * 🔴 **Logged out, the invite has to survive registering.** Every existing
 * member was onboarded exactly this way: someone sent a link, they had no
 * account, and the link is the only thing connecting the account they are
 * about to make to the league that invited them. The uuid rides through as
 * Clerk's `redirect_url`, so they land back here with a session.
 *
 * The league is named *before* they register, deliberately. "Log in to
 * continue" with no indication of what you are joining is indistinguishable
 * from phishing.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;

  const league = await leagueRepository.findByUuid(uuid);
  // A mistyped or retired invite. 404 rather than an error: it is a user
  // mistake, and it reveals nothing about which uuids are real.
  if (!league) notFound();

  const { userId } = await auth();

  if (!userId) {
    return (
      <Frame name={league.name}>
        <p className="text-text-secondary text-sm leading-relaxed">
          You need an account first. Register with the email you already use and your
          existing leagues, drafts and points come with you — then you land back here to
          join.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/auth/register?redirect_url=/join/${uuid}`}
            className="bg-accent-fill focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Register
          </Link>
          <Link
            href={`/auth/login?redirect_url=/join/${uuid}`}
            className="bg-bg-raised text-text-primary hover:text-accent-text focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm px-4 text-sm transition-colors focus-visible:outline-2"
          >
            I already have an account
          </Link>
        </div>
      </Frame>
    );
  }

  const user = await getCurrentUser();
  const existing = user
    ? await draftRepository.findByLeagueIdAndUserId(league.id, user.id)
    : null;

  if (existing) {
    // Not an error, and worth saying plainly: following your own invite twice,
    // or a link someone re-sent, should read as "you are already in" rather
    // than as a failure.
    return (
      <Frame name={league.name}>
        <p className="text-text-secondary text-sm leading-relaxed">
          You are already in this league.
        </p>
        <Link
          href={`/leagues/${league.id}`}
          className="bg-bg-raised text-text-primary hover:text-accent-text focus-visible:outline-accent-fill flex min-h-11 w-fit items-center rounded-sm px-4 text-sm transition-colors focus-visible:outline-2"
        >
          Go to the league
        </Link>
      </Frame>
    );
  }

  return (
    <Frame name={league.name}>
      <p className="text-text-secondary text-sm leading-relaxed">
        You have been invited to play. Joining seats you for this season.
      </p>
      <JoinLeagueButton uuid={uuid} />
    </Frame>
  );
}

function Frame({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <SectionHead as="h1" name eyebrow="Invitation" className="pb-0">
          {name}
        </SectionHead>
        {children}
      </div>
    </>
  );
}
