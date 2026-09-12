// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadBrowse = vi.hoisted(() => vi.fn());
vi.mock('@/lib/services/browse', () => ({ loadBrowse }));

const getCurrentUser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ getCurrentUser }));

import { loadBrowsePage } from './load-page';

const SHELF = { when: 'past' as const, page: 2, pageCount: 9, months: [] };

describe('loadBrowsePage', () => {
  beforeEach(() => {
    loadBrowse.mockReset().mockResolvedValue(SHELF);
    getCurrentUser.mockReset().mockResolvedValue(null);
  });

  it('returns the requested page', async () => {
    const result = await loadBrowsePage({ when: 'past', page: 2 });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.page).toBe(2);
    expect(result.ok && result.data.pageCount).toBe(9);
  });

  it('🔴 resolves the reader itself rather than taking a user id', async () => {
    // A userId parameter would let any caller ask for another reader's watched
    // marks. The action reads the session and nothing else.
    getCurrentUser.mockResolvedValue({ id: 42 });
    await loadBrowsePage({ when: 'past', page: 2 });

    expect(loadBrowse).toHaveBeenCalledWith({ when: 'past', page: 2, userId: 42 });
  });

  it('asks for an anonymous shelf when there is no session', async () => {
    await loadBrowsePage({ when: 'future', page: 3 });

    expect(loadBrowse).toHaveBeenCalledWith({ when: 'future', page: 3, userId: null });
  });

  it('rejects a page number that is not a positive integer', async () => {
    const result = await loadBrowsePage({ when: 'past', page: -3 });

    expect(result.ok).toBe(false);
    expect(loadBrowse).not.toHaveBeenCalled();
  });

  it('rejects a side that is neither past nor future', async () => {
    // The argument arrives from the client, so the signature proves nothing.
    const result = await loadBrowsePage({
      when: 'sideways' as 'past',
      page: 1,
    });

    expect(result.ok).toBe(false);
    expect(loadBrowse).not.toHaveBeenCalled();
  });
});
