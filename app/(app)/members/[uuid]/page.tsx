import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { deleteFeedItem } from '@/actions/profile/delete-feed-item';
import { postFeedItem } from '@/actions/profile/post-feed-item';
import { EmptyState } from '@/components/EmptyState';
import { FeedComposer } from '@/components/FeedComposer';
import { FeedPost } from '@/components/FeedPost';
import { Panel } from '@/components/Panel';
import { RemoteImage } from '@/components/RemoteImage';
import { SectionHead } from '@/components/SectionHead';
import { getCurrentUser } from '@/lib/auth';
import { loadMemberProfile, loadProfileMember } from '@/lib/services/profile';
import { formatDay } from '@/lib/utils/format';

/**
 * A member's profile and activity feed (P10.T40, T41, T42).
 *
 * 🔴 **Public (P17.T37), the same way a league page is (D44/D45).** The league
 * page is the member index — every seat links here — so a link pasted into a
 * group chat has to open for whoever taps it. Public is not discoverable:
 * `robots: index:false` below, `app/robots.ts` disallows `/members`,
 * `app/sitemap.ts` omits it, and `/members` itself 404s. There is no door
 * marked "everyone".
 *
 * 🔴 **The avatar is withheld from a signed-out reader, and only from them.**
 * 51 of 60 stored avatars are Gravatar URLs whose path is `MD5(email)`, so
 * publishing the `<img src>` publishes a weak hash of the address: a stranger
 * can confirm a guessed address against a named member, and a common address
 * falls to a published rainbow table. The DTO itself is clean — `ProfileMember`
 * is uuid, name, image and memberSince, with no email anywhere — so the image
 * is the only leak, and `initials` is the switch that closes it. Members still
 * see each other's faces. (Re-hosting those 51 legacy Auth0 URLs would remove
 * the hash for everyone rather than only for strangers, and is the better
 * long-term answer — but that is a migration, not this task.)
 *
 * The viewer only decides what is *offered*: the composer and the delete
 * control appear on your own profile, and an anonymous reader is nobody's self,
 * so neither is offered at all. Both actions resolve the target feed from the
 * session, so neither depends on that decision holding (R15).
 */

export async function generateMetadata({
  params,
}: PageProps<'/members/[uuid]'>): Promise<Metadata> {
  const { uuid } = await params;
  const member = await loadProfileMember(uuid);
  if (!member) return { title: 'Not here' };

  return {
    title: member.name,
    description: `${member.name}'s drafts, reviews and posts.`,
    // 🔴 Kept after the page went public (P17.T37). Public so a pasted link
    // opens; not discoverable, exactly like a league page. Removing this is
    // what would publish sixty real people's names to a crawler.
    robots: { index: false, follow: false },
  };
}

export default async function MemberProfilePage({
  params,
}: PageProps<'/members/[uuid]'>) {
  const { uuid } = await params;

  const viewer = await getCurrentUser();
  const profile = await loadMemberProfile(uuid);
  if (!profile) notFound();

  const { member, feed } = profile;
  // An anonymous reader is nobody's self, so nothing that writes is offered.
  const isSelf = viewer != null && viewer.uuid !== null && viewer.uuid === member.uuid;
  const since = formatDay(member.memberSince);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <header className="flex items-center gap-4">
        {/* 🔴 `viewer == null` is the whole switch: a signed-out reader gets
            initials, because the stored URL is `MD5(email)` for 51 of 60
            members. A signed-in one gets the face. */}
        <Avatar name={member.name} image={viewer == null ? null : member.image} />
        <SectionHead
          as="h1"
          name
          eyebrow={since ? `Member since ${since}` : undefined}
          right={feed.length > 0 ? String(feed.length) : undefined}
          className="min-w-0 flex-1 pb-0"
        >
          {member.name}
        </SectionHead>
      </header>

      {isSelf ? (
        <Panel className="p-4">
          <FeedComposer onPost={postFeedItem} />
        </Panel>
      ) : null}

      {feed.length === 0 ? (
        <EmptyState
          title={isSelf ? 'Your feed is empty' : `${member.name} has not posted yet`}
          action={isSelf ? { label: 'Browse films', href: '/browse' } : undefined}
        >
          {isSelf
            ? 'Draft some films or write a review, and it lands here.'
            : 'Once they draft a season or write a review, it shows up here.'}
        </EmptyState>
      ) : (
        <section className="flex flex-col gap-4">
          <h2 className="sr-only">Activity</h2>
          {feed.map((item) => (
            <FeedPost
              key={item.id}
              item={item}
              onDelete={isSelf ? deleteFeedItem : undefined}
            />
          ))}
        </section>
      )}
    </div>
  );
}

/**
 * The face, or the initial.
 *
 * 🔴 `image` is null for a signed-out reader by the caller's decision, not by
 * this component's (P17.T37): the stored URL is `MD5(email)` for 51 of 60
 * members. The fallback branch already existed for the 5 members who have no
 * avatar at all; it is now also what a stranger sees.
 */
function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      <RemoteImage
        src={image}
        alt=""
        width={56}
        height={56}
        data-testid="member-avatar"
        className="bg-bg-surface h-14 w-14 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      data-testid="member-initials"
      className="bg-bg-surface text-text-secondary flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-mono text-lg"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
