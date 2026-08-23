// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ requireAdmin }));

import { ForbiddenError } from '@/lib/errors';
import AdminPage from './page';

/**
 * 🔴 The page-level gate. This index links every admin control in the app
 * (season, relink, broadcast), so a missing gate here discloses the map of
 * every dangerous control to anyone who reaches the URL.
 */
describe('AdminPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('🔴 refuses to render for a non-admin', async () => {
    requireAdmin.mockRejectedValue(new ForbiddenError('admin only'));

    await expect(AdminPage()).rejects.toThrow('admin only');
  });

  it('renders for an admin', async () => {
    requireAdmin.mockResolvedValue({ id: 1, role: 'admin' });

    const element = await AdminPage();
    expect(element).toBeTruthy();
  });
});
