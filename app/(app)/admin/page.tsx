import Link from 'next/link';

import { Panel } from '@/components/Panel';
import { SectionHead } from '@/components/SectionHead';
import { requireAdmin } from '@/lib/auth';

/**
 * Where the admin-only controls are reachable from (D22).
 *
 * The seven-destination nav is a deliberate override (D62) and these pages are
 * not among them, so without this index the controls exist and no one can find
 * them — a row is closed when a person can do the thing, not when the action
 * exists (D53).
 */
export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="text-text-primary mx-auto flex max-w-3xl flex-col gap-6">
      <SectionHead as="h1">Admin</SectionHead>

      <ul className="flex flex-col gap-3">
        {[
          {
            href: '/admin/season',
            label: 'Active season',
            detail: 'Move the season every page is scoped to.',
          },
          {
            href: '/admin/relink',
            label: 'Relink an account',
            detail: 'Move an account between people. The only code that can.',
          },
          {
            href: '/admin/broadcast',
            label: 'Broadcast a notification',
            detail: 'Send one message to every member. Cannot be recalled.',
          },
        ].map((entry) => (
          <li key={entry.href}>
            <Panel>
              <Link
                href={entry.href}
                className="focus-visible:outline-accent-fill flex flex-col gap-1 focus-visible:outline-2"
              >
                <span className="text-sm">{entry.label}</span>
                <span className="text-text-secondary text-xs">{entry.detail}</span>
              </Link>
            </Panel>
          </li>
        ))}
      </ul>
    </div>
  );
}
