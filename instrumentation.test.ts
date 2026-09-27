import { afterEach, describe, expect, it, vi } from 'vitest';

import { register } from './instrumentation';

/**
 * 🔴 The filter has to be exactly as wide as React's one message. Too narrow and
 * every abandoned navigation is an error line again; too wide and a real fault
 * disappears, which is worse than the noise it was removing.
 */
describe('register', () => {
  const original = console.error;
  afterEach(() => {
    console.error = original;
    vi.unstubAllEnvs();
  });

  it('drops the client-left abort and passes every other error through', () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    const underlying = vi.fn();
    console.error = underlying;
    register();

    // The shape Next actually prints it in — its `⨯` prefix first, the error
    // second (`next/dist/build/output/log.js`) — and the bare form.
    console.error('⨯', new Error('The destination stream closed early.'));
    console.error(new Error('The destination stream closed early.'));
    expect(underlying).not.toHaveBeenCalled();

    const real = new Error('The destination stream errored while writing data.');
    console.error(real);
    console.error('[live stream] poll failed; keeping the last frame', new Error('down'));
    // A string carrying the words is not React's abort, and is kept.
    console.error('The destination stream closed early.');
    expect(underlying).toHaveBeenCalledTimes(3);
    expect(underlying).toHaveBeenNthCalledWith(1, real);
  });
});
