/**
 * Typed errors for the data and service layers.
 *
 * Repositories throw these. Route segments catch them in `error.tsx`. Server
 * Actions convert them into the `ActionResult` union rather than letting them
 * cross the boundary, because an exception thrown out of a Server Action
 * reaches the client as an opaque digest with no usable message.
 *
 * Never let a raw database error escape a repository. The source app returned
 * Postgres errors verbatim — a failing query leaked the full SQL, the column
 * list and Postgres internals to the client, which is a schema disclosure on
 * any error path.
 */

export type AppErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT';

export abstract class AppError extends Error {
  /**
   * A literal field rather than a getter, and duplicated by `isAppError`
   * below, because RSC and Server Action payloads do not preserve prototypes.
   * An error that crossed that boundary must still be identifiable.
   */
  abstract readonly code: AppErrorCode;

  readonly isAppError = true;

  constructor(message: string) {
    super(message);
    // Extending a builtin does not set `name`, so every subclass would
    // otherwise report as "Error" in logs and stack traces.
    this.name = new.target.name;
  }
}

/** A record that was asked for by id and does not exist. */
export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND' as const;

  constructor(
    readonly resource: string,
    readonly id: string | number | bigint,
  ) {
    super(`${resource} ${id} not found`);
  }
}

/** The caller is authenticated but not allowed to do this. */
export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN' as const;
}

/** The write conflicts with a rule the database enforces. */
export class ConflictError extends AppError {
  readonly code = 'CONFLICT' as const;
}

/**
 * Structural check, not `instanceof`.
 *
 * An error thrown on the server and read on the client has lost its prototype
 * chain, so `instanceof AppError` returns false for what is genuinely one of
 * ours. Checking the shape is what makes these usable on both sides.
 */
export function isAppError(value: unknown): value is AppError {
  return (
    value instanceof Error &&
    'isAppError' in value &&
    (value as { isAppError?: unknown }).isAppError === true
  );
}
