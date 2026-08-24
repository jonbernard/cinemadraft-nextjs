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
import { requireUser } from '@/lib/auth';
import { loadMemberProfile, loadProfileMember } from '@/lib/services/profile';
import { formatDay } from '@/lib/utils/format';

/**
 * A member's profile and activity feed (P10.T40, T41, T42).
 *
 * 🔴 **Readable by any signed-in member, and not public** (R7). A profile is by
 * definition about someone else, so it is not scoped to the viewer the way the
 * rest of batch E is — but a directory of real people's names is not
 * crawler-facing either, so it stays out of `proxy.ts`'s public matcher.
 *
 * The viewer only decides what is *offered*: the composer and the delete
 * control appear on your own profile. Both actions resolve the target feed from
 * the session, so neither depends on that decision holding (R15).
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
    // A member list is not for crawlers, and this page is behind a login.
    robots: { index: false, follow: false },
  };
}

export default async function MemberProfilePage({
  params,
}: PageProps<'/members/[uuid]'>) {
  const { uuid } = await params;

  const viewer = await requireUser();
  const profile = await loadMemberProfile(uuid);
  if (!profile) notFound();

  const { member, feed } = profile;
  const isSelf = viewer.uuid !== null && viewer.uuid === member.uuid;
  const since = formatDay(member.memberSince);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex items-center gap-4">
        <Avatar name={member.name} image={member.image} />
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

function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      <RemoteImage
        src={image}
        alt=""
        width={56}
        height={56}
        className="bg-bg-raised h-14 w-14 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="bg-bg-raised text-text-secondary flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-mono text-lg"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
