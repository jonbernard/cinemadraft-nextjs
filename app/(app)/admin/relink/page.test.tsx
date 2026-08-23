// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ requireAdmin }));

import { ForbiddenError } from '@/lib/errors';
import AdminRelinkPage from './page';

/**
 * 🔴 The page-level gate. `relinkUser` is the only code in the app that can
 * move an account between people (D25); the page gate is a second, independent
 * check that a non-admin never even sees the controls, on top of the one the
 * action itself performs.
 */
describe('AdminRelinkPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('🔴 refuses to render for a non-admin', async () => {
    requireAdmin.mockRejectedValue(new ForbiddenError('admin only'));

    await expect(AdminRelinkPage()).rejects.toThrow('admin only');
  });

  it('renders for an admin', async () => {
    requireAdmin.mockResolvedValue({ id: 1, role: 'admin' });

    const element = await AdminRelinkPage();
    expect(element).toBeTruthy();
  });
});
