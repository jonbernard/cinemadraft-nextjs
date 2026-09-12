import type { Metadata } from 'next';
import Link from 'next/link';

import { Panel } from '@/components/Panel';
import { SectionHead } from '@/components/SectionHead';
import { StatusChip } from '@/components/StatusChip';
import { requireAdmin } from '@/lib/auth';
import { NOINDEX } from '@/lib/seo';

/**
 * Where the admin-only controls are reachable from (D22).
 *
 * The seven-destination nav is a deliberate override (D62) and these pages are
 * not among them, so without this index the controls exist and no one can find
 * them — a row is closed when a person can do the thing, not when the action
 * exists (D53).
 */
export const metadata: Metadata = {
  // Nothing behind this page is for a stranger, and the proxy already answers
  // for it (D44). This only keeps it out of search results.
  robots: NOINDEX,
  title: 'Admin',
};

export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="text-text-primary mx-auto flex max-w-3xl flex-col gap-10">
      <SectionHead as="h1">Admin</SectionHead>

      {/* 🔴 Two groups, not one list (P17.T32). Three identical cards, two of
          which cannot be undone for any member, read as a settings page — and
          the first of them re-scopes every league, draft, award show and
          dashboard in the product. The reach is named in words on each entry,
          never carried by colour alone, and the group boundary is space rather
          than a rule (D72/D74). */}
      <section className="flex flex-col gap-4">
        <SectionHead as="h2" eyebrow="Cannot be undone">
          Affects every member
        </SectionHead>

        <ul className="flex flex-col gap-3">
          <AdminEntry
            href="/admin/season"
            label="Active season"
            reach="Re-scopes every league, draft, award show and dashboard, for every member, immediately."
          />
          <AdminEntry
            href="/admin/broadcast"
            label="Broadcast a notification"
            reach="Sends one message to every member. Cannot be recalled."
          />
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHead as="h2">Affects one account</SectionHead>

        <ul className="flex flex-col gap-3">
          <AdminEntry
            href="/admin/relink"
            label="Relink an account"
            detail="Move an account between people. The only code that can."
          />
        </ul>
      </section>
    </div>
  );
}

/**
 * One admin destination.
 *
 * `reach` rather than `detail` marks an entry whose effect lands on everybody:
 * it renders a carmine chip beside the label — carmine is urgency and
 * destructive actions (D69) — *and* states the reach in words, because colour
 * is never the only carrier of state.
 */
function AdminEntry({
  href,
  label,
  reach,
  detail,
}: {
  href: string;
  label: string;
  reach?: string;
  detail?: string;
}) {
  return (
    <li>
      <Panel>
        <Link
          href={href}
          className="focus-visible:outline-accent-fill flex flex-col gap-1 focus-visible:outline-2"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{label}</span>
            {reach ? <StatusChip tone="carmine">Every member</StatusChip> : null}
          </span>
          <span className="text-text-secondary text-xs">{reach ?? detail}</span>
        </Link>
      </Panel>
    </li>
  );
}
