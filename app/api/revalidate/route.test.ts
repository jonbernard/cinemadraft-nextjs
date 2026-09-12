import { beforeEach, describe, expect, it, vi } from 'vitest';

// revalidatePath needs a request store no test has; the call itself is the
// behaviour under test, so it is recorded rather than performed.
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

import { POST } from './route';

function request(body: unknown): Request {
  return new Request('https://cinemadraft.com/api/revalidate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  revalidatePath.mockClear();
  process.env.REVALIDATE_SECRET = 'correct-horse-battery-staple';
});

describe('POST /api/revalidate', () => {
  it('revalidates the show, the index, the leaderboard and the home page', async () => {
    const response = await POST(
      request({ secret: 'correct-horse-battery-staple', abbreviation: 'dga' }),
    );

    expect(response.status).toBe(200);
    expect(revalidatePath.mock.calls).toEqual([
      ['/award-shows/dga', 'layout'],
      ['/award-shows'],
      ['/leaderboard'],
      ['/'],
    ]);
  });

  // 🔴 404, not 401: a 401 confirms the route exists and that the secret is
  // the only thing missing, which is free help toward guessing one.
  it('answers 404 to a wrong secret and revalidates nothing', async () => {
    const response = await POST(request({ secret: 'wrong', abbreviation: 'dga' }));
    expect(response.status).toBe(404);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('answers 404 to a missing secret', async () => {
    const response = await POST(request({ abbreviation: 'dga' }));
    expect(response.status).toBe(404);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  // 🔴 The caller names a show, never a path. Otherwise this is an open
  // invalidation endpoint for every route in the app.
  it('refuses an abbreviation that is not a plain slug', async () => {
    const response = await POST(
      request({ secret: 'correct-horse-battery-staple', abbreviation: '../../admin' }),
    );
    expect(response.status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('answers 404 when the server has no secret configured', async () => {
    process.env.REVALIDATE_SECRET = '';
    const response = await POST(request({ secret: 'anything', abbreviation: 'dga' }));
    expect(response.status).toBe(404);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  // 🔴 A malformed body is a prober, not a client. It must meet the same 404
  // as a wrong secret — a 500 here would confirm the route exists.
  it('answers 404 to a body that is not JSON', async () => {
    const response = await POST(
      new Request('https://cinemadraft.com/api/revalidate', {
        method: 'POST',
        body: 'not json',
      }),
    );
    expect(response.status).toBe(404);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
