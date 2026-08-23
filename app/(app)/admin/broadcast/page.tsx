import { BroadcastPanel } from '@/components/BroadcastPanel';
import { SectionHead } from '@/components/SectionHead';
import { requireAdmin } from '@/lib/auth';
import { userRepository } from '@/lib/repositories/users';

/**
 * Admin broadcast (T45).
 *
 * `requireAdmin()` gates the page independently of `broadcastNotification`
 * gating the action itself — a Server Action's id ships in the client bundle
 * regardless of whether this page exists, so the page gate alone would not be
 * gating (same reasoning as the relink page).
 *
 * The recipient count is read here, server-side, so the confirmation on
 * `BroadcastPanel` names a real number rather than a guess.
 */
export default async function AdminBroadcastPage() {
  await requireAdmin();

  const recipientCount = (await userRepository.findAllIds()).length;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <SectionHead as="h1">Broadcast a notification</SectionHead>

      <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
        Sends one notification to every member at once — the only kind of broadcast the
        source app ever sent, regardless of what it claimed to target. There is no way to
        delete or recall it afterwards, so nothing goes out without confirming.
      </p>

      <BroadcastPanel recipientCount={recipientCount} />
    </div>
  );
}
