// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ requireAdmin }));

const findAll = vi.hoisted(() => vi.fn());
vi.mock('@/lib/repositories/available-years', () => ({
  availableYearRepository: { findAll },
}));

import { ForbiddenError } from '@/lib/errors';
import AdminSeasonPage from './page';

/**
 * 🔴 The page-level gate, independent of the one on `setActiveYear` itself.
 *
 * A Server Action's id ships in the client bundle whether or not this page
 * exists, so the action's own `requireAdmin()` call is what actually stops a
 * non-admin from moving the season — but the page is reached by URL, and a
 * page that renders admin controls to anyone who is not one is a bug in its
 * own right, independent of whether the write beneath it holds.
 */
describe('AdminSeasonPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('🔴 refuses to render for a non-admin', async () => {
    requireAdmin.mockRejectedValue(new ForbiddenError('admin only'));

    await expect(AdminSeasonPage()).rejects.toThrow('admin only');
    expect(findAll).not.toHaveBeenCalled();
  });

  it('renders for an admin', async () => {
    requireAdmin.mockResolvedValue({ id: 1, role: 'admin' });
    findAll.mockResolvedValue([
      { id: 1, year: 2025, isActive: false },
      { id: 2, year: 2026, isActive: true },
    ]);

    const element = await AdminSeasonPage();
    expect(element).toBeTruthy();
  });
});
