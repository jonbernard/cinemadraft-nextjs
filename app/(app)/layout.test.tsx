// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

const getCurrentUser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return { ...actual, getCurrentUser };
});

const findByUser = vi.hoisted(() => vi.fn());
const countUnreadByUser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/repositories/notifications', () => ({
  notificationRepository: { findByUser, countUnreadByUser },
}));

vi.mock('@/components/AppShell', () => ({
  AppShell: () => null,
}));

import { AccountLinkError } from '@/lib/auth';
import AppLayout from './layout';

function propsOf(element: unknown) {
  return (element as { props: { isSignedIn: boolean; isAdmin: boolean } }).props;
}

/**
 * 🔴 F3: `getCurrentUser()` throws `AccountLinkError` for a collided
 * account (D25). A layout throw is not caught by `(app)/error.tsx` — it
 * bubbles past the shell to the bare root boundary — so a collided account
 * would otherwise lose every page under `(app)`, public ones included. The
 * layout must instead render the shell signed-out: no admin gear, no
 * notification fetch, but still a shell around the public pages.
 */
describe('AppLayout', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('🔴 renders the shell signed-out for a collided account, rather than throwing', async () => {
    getCurrentUser.mockRejectedValue(new AccountLinkError('clerk_collided'));

    const element = await AppLayout({ children: 'child' } as never);

    expect(findByUser).not.toHaveBeenCalled();
    expect(countUnreadByUser).not.toHaveBeenCalled();
    const props = propsOf(element);
    expect(props.isSignedIn).toBe(false);
    expect(props.isAdmin).toBe(false);
  });

  it('re-throws any other error', async () => {
    getCurrentUser.mockRejectedValue(new Error('boom'));

    await expect(AppLayout({ children: 'child' } as never)).rejects.toThrow('boom');
  });

  it('renders the shell signed-in for a resolved user', async () => {
    getCurrentUser.mockResolvedValue({ id: 1, role: 'admin' });
    findByUser.mockResolvedValue([]);
    countUnreadByUser.mockResolvedValue(0);

    const element = await AppLayout({ children: 'child' } as never);

    const props = propsOf(element);
    expect(props.isSignedIn).toBe(true);
    expect(props.isAdmin).toBe(true);
  });
});
