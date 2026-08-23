'use client';

import { useCallback, useState, useTransition } from 'react';

import { findUserForRelink } from '@/actions/admin/find-user';
import { relinkUser } from '@/actions/admin/relink';

type FoundUser = {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  clerkId: string | null;
};

function displayName(user: FoundUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name === '' ? user.email : `${name} (${user.email})`;
}

/**
 * Move an account between identities (T49).
 *
 * 🔴 This is the only code in the app that can do that (D25), so the page
 * says exactly what it is about to do rather than presenting a generic form:
 * it names the account it found, states what a relink or an unlink will do to
 * it, and neither happens without a confirm naming the account by name.
 *
 * Relink and unlink are two distinct, clearly separated actions — not one
 * text field that happens to accept empty. An empty field reading as "unlink"
 * is exactly the kind of thing an admin could do by accident while meaning to
 * leave the field for later.
 */
export function RelinkPanel() {
  const [email, setEmail] = useState('');
  const [user, setUser] = useState<FoundUser | null>(null);
  const [clerkId, setClerkId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const find = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const trimmed = email.trim();
      if (trimmed === '') return;

      setMessage(null);
      setUser(null);
      startTransition(async () => {
        const result = await findUserForRelink(trimmed);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        setUser(result.data);
        setClerkId(result.data.clerkId ?? '');
      });
    },
    [email],
  );

  const relink = useCallback(() => {
    if (!user) return;
    const trimmed = clerkId.trim();
    if (trimmed === '') {
      setMessage('Enter a Clerk identity to link to, or use Unlink below.');
      return;
    }
    if (
      !window.confirm(
        `Move ${displayName(user)}'s drafts, picks, reviews and watchlist to Clerk identity "${trimmed}"? This cannot be undone from this page.`,
      )
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const updated = await relinkUser(user.id, trimmed);
        setUser({ ...user, clerkId: updated.clerkId });
        setMessage(`${displayName(user)} is now linked to ${trimmed}.`);
      } catch {
        setMessage('That did not work.');
      }
    });
  }, [user, clerkId]);

  const unlink = useCallback(() => {
    if (!user) return;
    if (
      !window.confirm(
        `Unlink ${displayName(user)} from ${user.clerkId ?? 'its current identity'}? They will not be able to sign in again until an admin relinks them.`,
      )
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const updated = await relinkUser(user.id, null);
        setUser({ ...user, clerkId: updated.clerkId });
        setClerkId('');
        setMessage(`${displayName(user)} is now unlinked.`);
      } catch {
        setMessage('That did not work.');
      }
    });
  }, [user]);

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={find} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-text-dim text-xs">Find an account by email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="member@example.com"
            className="border-border-rule bg-bg-raised text-text-primary min-h-11 w-72 border px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="border-border-rule text-text-primary hover:bg-bg-raised min-h-11 border px-4 text-sm disabled:opacity-60"
        >
          Find
        </button>
      </form>

      {user ? (
        <div className="bg-bg-raised flex flex-col gap-4 rounded-md p-4">
          <p className="text-text-primary text-sm">
            <strong>{displayName(user)}</strong> is currently{' '}
            {user.clerkId ? (
              <>
                linked to <span className="tabular font-mono">{user.clerkId}</span>
              </>
            ) : (
              'not linked to any sign-in'
            )}
            .
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-text-dim text-xs">New Clerk identity</span>
            <input
              type="text"
              value={clerkId}
              onChange={(event) => setClerkId(event.target.value)}
              placeholder="user_..."
              className="border-border-rule bg-bg-raised text-text-primary min-h-11 w-96 border px-3 text-sm"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={relink}
              disabled={pending}
              className="bg-accent-fill min-h-11 w-fit px-4 text-sm text-white disabled:opacity-60"
            >
              Relink to this identity
            </button>
            <button
              type="button"
              onClick={unlink}
              disabled={pending || !user.clerkId}
              className="border-border-rule text-text-primary hover:bg-bg-raised min-h-11 w-fit border px-4 text-sm disabled:opacity-60"
            >
              Unlink
            </button>
          </div>
        </div>
      ) : null}

      <p aria-live="polite" className="text-text-secondary min-h-5 text-sm">
        {pending ? 'Working…' : (message ?? '')}
      </p>
    </div>
  );
}
