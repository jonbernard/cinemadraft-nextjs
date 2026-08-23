// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ requireAdmin }));

const findAllIds = vi.hoisted(() => vi.fn());
vi.mock('@/lib/repositories/users', () => ({
  userRepository: { findAllIds },
}));

import { ForbiddenError } from '@/lib/errors';
import AdminBroadcastPage from './page';

/**
 * 🔴 The page-level gate. This page discloses the member count via
 * `userRepository.findAllIds().length` and is the only surface that reaches
 * `broadcastNotification`, so a missing gate leaks both.
 */
describe('AdminBroadcastPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('🔴 refuses to render for a non-admin', async () => {
    requireAdmin.mockRejectedValue(new ForbiddenError('admin only'));

    await expect(AdminBroadcastPage()).rejects.toThrow('admin only');
    expect(findAllIds).not.toHaveBeenCalled();
  });

  it('renders for an admin', async () => {
    requireAdmin.mockResolvedValue({ id: 1, role: 'admin' });
    findAllIds.mockResolvedValue([1, 2, 3]);

    const element = await AdminBroadcastPage();
    expect(element).toBeTruthy();
  });
});
