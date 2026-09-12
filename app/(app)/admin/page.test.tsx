import { render, screen } from '@testing-library/react';
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

  it('🔴 marks the entries that change the product for everyone', async () => {
    // Three identical cards, two of which are irreversible for every member,
    // reads as a settings list — and the first of them re-scopes every page in
    // the product. The reach is named in words, never by colour alone.
    requireAdmin.mockResolvedValue({ id: 1, role: 'admin' });
    render(await AdminPage());

    const scoped = screen.getByRole('link', { name: /Active season/ });
    expect(scoped.textContent).toMatch(/every member|everyone/i);

    expect(
      screen.getByRole('heading', { name: /affects every member/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /affects one account/i }),
    ).toBeInTheDocument();
  });

  it('🔴 leaves the single-account entry unmarked, so the mark means something', async () => {
    // A badge on every row is a decoration. Relinking touches one account and
    // must not carry the chip that says it reaches everybody.
    requireAdmin.mockResolvedValue({ id: 1, role: 'admin' });
    render(await AdminPage());

    expect(
      screen.getByRole('link', { name: /Relink an account/ }).textContent,
    ).not.toMatch(/every member/i);
    expect(screen.getAllByText('Every member')).toHaveLength(2);
  });
});
