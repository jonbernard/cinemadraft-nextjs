// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

const requirePageAdmin = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ requirePageAdmin }));

const findAll = vi.hoisted(() => vi.fn());
vi.mock('@/lib/repositories/available-years', () => ({
  availableYearRepository: { findAll },
}));

const findAllIds = vi.hoisted(() => vi.fn());
vi.mock('@/lib/repositories/users', () => ({
  userRepository: { findAllIds },
}));

import { ForbiddenError } from '@/lib/errors';
import AdminSeasonPage from './page';

/**
 * 🔴 The page-level gate, independent of the one on `setActiveYear` itself.
 *
 * A Server Action's id ships in the client bundle whether or not this page
 * exists, so the action's own `requirePageAdmin()` call is what actually stops a
 * non-admin from moving the season — but the page is reached by URL, and a
 * page that renders admin controls to anyone who is not one is a bug in its
 * own right, independent of whether the write beneath it holds.
 */
describe('AdminSeasonPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('refuses to render for a non-admin', async () => {
    requirePageAdmin.mockRejectedValue(new ForbiddenError('admin only'));

    await expect(AdminSeasonPage()).rejects.toThrow('admin only');
    expect(findAll).not.toHaveBeenCalled();
    expect(findAllIds).not.toHaveBeenCalled();
  });

  it('renders for an admin', async () => {
    requirePageAdmin.mockResolvedValue({ id: 1, role: 'admin' });
    findAll.mockResolvedValue([
      { id: 1, year: 2025, isActive: false },
      { id: 2, year: 2026, isActive: true },
    ]);
    findAllIds.mockResolvedValue([1, 2, 3]);

    const element = await AdminSeasonPage();
    expect(element).toBeTruthy();
  });

  it('hands the control a member count read on the server', async () => {
    // The confirmation has to name a real number, not one the client invented
    // — the same reason `/admin/broadcast` reads its recipient count here
    // (P17.T28). Asserted on the prop rather than on rendered text, because the
    // count only reaches the browser through this one channel.
    requirePageAdmin.mockResolvedValue({ id: 1, role: 'admin' });
    findAll.mockResolvedValue([{ id: 2, year: 2026, isActive: true }]);
    findAllIds.mockResolvedValue([1, 2, 3, 4, 5, 6, 7]);

    const control = find(
      await AdminSeasonPage(),
      (node) => node.props?.memberCount !== undefined,
    );

    expect(control?.props.memberCount).toBe(7);
    expect(control?.props.seasons).toEqual([{ year: 2026, isActive: true }]);
  });
});

/** First node in the returned element tree matching `predicate`. */
// biome-ignore lint/suspicious/noExplicitAny: walking an opaque React element tree
function find(node: any, predicate: (node: any) => boolean): any {
  if (node == null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, predicate);
      if (hit) return hit;
    }
    return null;
  }
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
}
