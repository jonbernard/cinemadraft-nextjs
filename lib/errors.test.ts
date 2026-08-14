import { describe, expect, it } from 'vitest';

import {
  AppError,
  ConflictError,
  ForbiddenError,
  isAppError,
  NotFoundError,
} from './errors';

describe('AppError subclasses', () => {
  it('carry a machine-readable code', () => {
    expect(new NotFoundError('movie', 1).code).toBe('NOT_FOUND');
    expect(new ForbiddenError('not your league').code).toBe('FORBIDDEN');
    expect(new ConflictError('year already active').code).toBe('CONFLICT');
  });

  it('set name to the class name', () => {
    // Without this, every subclass reports as "Error" in logs and stack
    // traces, because extending a builtin does not set name automatically.
    expect(new NotFoundError('movie', 1).name).toBe('NotFoundError');
    expect(new ForbiddenError('nope').name).toBe('ForbiddenError');
  });

  it('survive instanceof across the class hierarchy', () => {
    const err = new NotFoundError('movie', 1);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it('build a readable message for a missing record', () => {
    expect(new NotFoundError('movie', 1).message).toBe('movie 1 not found');
    expect(new NotFoundError('user', 'abc').message).toBe('user abc not found');
  });

  it('expose what was not found, for callers that need to branch', () => {
    const err = new NotFoundError('movie', 42);
    expect(err.resource).toBe('movie');
    expect(err.id).toBe(42);
  });
});

describe('isAppError', () => {
  it('recognises our errors', () => {
    expect(isAppError(new NotFoundError('movie', 1))).toBe(true);
    expect(isAppError(new ConflictError('x'))).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isAppError(new Error('plain'))).toBe(false);
    expect(isAppError('NOT_FOUND')).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError({ code: 'NOT_FOUND' })).toBe(false);
  });

  it('recognises an error that crossed a serialization boundary', () => {
    // Server Actions and RSC payloads do not preserve prototypes, so an error
    // arriving from the server fails instanceof. The guard falls back to the
    // shape, which is why code is a literal field rather than a getter.
    const revived = Object.assign(Object.create(Error.prototype), {
      name: 'NotFoundError',
      message: 'movie 1 not found',
      code: 'NOT_FOUND',
      isAppError: true,
    });
    expect(isAppError(revived)).toBe(true);
  });
});
