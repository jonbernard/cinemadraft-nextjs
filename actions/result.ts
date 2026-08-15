import { isAppError } from '@/lib/errors';

/**
 * What went wrong, in terms a UI can branch on.
 *
 * Mirrors `AppErrorCode` and adds `INVALID` for input that never reached a
 * repository — a Server Action's arguments arrive from the client and are
 * therefore untyped at runtime, whatever the signature says.
 */
export type ActionErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INVALID';

/**
 * The return of every Server Action in this app.
 *
 * Actions return failures rather than throwing them. An exception thrown out
 * of a Server Action reaches the client as an opaque digest with no usable
 * message — in production React deliberately replaces it with "An error
 * occurred in the Server Components render" — so a caller cannot tell "you do
 * not own this league" from "that film is already taken" from a crash. Both of
 * those are ordinary outcomes the owner needs to read mid-draft.
 *
 * A genuine bug still throws, and should: it belongs in the error boundary and
 * the logs, not in a toast.
 */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; code: ActionErrorCode; message: string };

export function ok(): ActionResult<null>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | null> {
  return { ok: true, data: data ?? null };
}

export function fail(code: ActionErrorCode, message: string): ActionResult<never> {
  return { ok: false, code, message };
}

/**
 * Turn a thrown `AppError` into a failure, and re-throw anything else.
 *
 * 🔴 The re-throw is the point. Swallowing every exception into a tidy
 * `{ ok: false }` would turn a connection failure or a programming error into
 * something the UI reports as a refused pick, and nothing would ever page.
 * Only the errors the domain defines are converted.
 */
export function toActionResult(error: unknown): ActionResult<never> {
  if (isAppError(error)) return fail(error.code, error.message);
  throw error;
}
