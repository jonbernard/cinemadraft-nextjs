/**
 * Server boot hook (Next's `instrumentation.ts` convention).
 *
 * 🔴 **One job: stop a reader who left from reading as a server error.** When
 * the browser abandons a client-side navigation while its RSC payload is still
 * rendering — a second click, a closed tab, TV mode toggled twice — React's
 * Flight renderer sees the socket close and aborts with a plain
 * `Error('The destination stream closed early.')`. Next's error handler drops
 * aborts by `name === 'AbortError'`, this one is named `Error`, so it is
 * printed as `⨯ Error: The destination stream closed early.` with a digest, at
 * error level, for something that is not a fault.
 *
 * Measured in a production build (P12.T5): 4 of 20 aborted `/live/[abbr]?tv=1`
 * navigations and 8 of 20 aborted `/` navigations logged it. The SSE routes
 * are NOT the source, which is what the Phase 14 note assumed: a disconnected,
 * cancelled, hidden or self-closed stream logs nothing, because its body is
 * piped with an abort signal Next already recognises.
 *
 * React raises that exact message from one place only — the destination's
 * `close` event, i.e. the client went away mid-render — so matching it cannot
 * hide a server fault. Everything else passes through untouched.
 *
 * ponytail: matches React's message text; delete this file once Next's
 * `isAbortError` covers it (checked against next 16.3.1 / react 19.3 canary).
 */
const CLIENT_LEFT = 'The destination stream closed early.';

export function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const error = console.error;
  console.error = (...args: unknown[]) => {
    // Any argument, not the first: Next prints it as `console.error('⨯', err)`
    // (`build/output/log.js`), so the error is second. A filter on the first
    // argument passed its unit test and dropped nothing in the real build.
    if (args.some((arg) => arg instanceof Error && arg.message === CLIENT_LEFT)) return;
    error(...args);
  };
}
