/**
 * Where a logged-out visitor is sent, and where they register.
 *
 * 🔴 These are constants in code, not environment variables, because they are
 * app routes rather than configuration — there is no environment in which the
 * login page should live anywhere else, and letting them vary is what broke
 * production.
 *
 * They previously existed only as `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and
 * `NEXT_PUBLIC_CLERK_SIGN_UP_URL` in `.env`, which `.gitignore` excludes
 * (`.env*`) and which therefore never reached Vercel. With them unset, Clerk
 * falls back to its hosted account portal on `*.accounts.dev` — a different
 * origin — so every RSC prefetch of a protected route (`?_rsc=…`, which is a
 * `fetch`) followed a cross-origin redirect and died in CORS. The console
 * filled with "No 'Access-Control-Allow-Origin' header" on a site whose auth
 * was, by every local measure, working.
 *
 * `e2e/auth.spec.ts` pins the redirect target and passed throughout, because
 * locally `.env` was present. A test cannot catch a value that only goes
 * missing where the test does not run; removing the value's ability to differ
 * is what catches it.
 *
 * Both consumers need them: `clerkMiddleware` in `proxy.ts` issues the
 * server-side redirect (it reads `signInUrl` from its options, falling back to
 * the env var), and `ClerkProvider` in `app/providers.tsx` gives the client
 * components the same answer.
 */
export const SIGN_IN_URL = '/auth/login';
export const SIGN_UP_URL = '/auth/register';
