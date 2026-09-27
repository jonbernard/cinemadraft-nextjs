import { describe, expect, it } from 'vitest';

import { resolveAdminMode } from './admin-mode';

describe('resolveAdminMode', () => {
  it('keeps everyone who is not an admin in View, whatever the URL asks for', () => {
    // The source honoured `/nominations` for anyone who typed it.
    for (const requested of ['nominations', 'winners', 'view', undefined]) {
      expect(resolveAdminMode(requested, { isAdmin: false, onAir: true })).toBe('view');
    }
  });

  it('gives an admin the mode they asked for', () => {
    expect(resolveAdminMode('nominations', { isAdmin: true, onAir: false })).toBe(
      'nominations',
    );
    expect(resolveAdminMode('winners', { isAdmin: true, onAir: false })).toBe('winners');
    // Explicit View on air is still View: the default is a default.
    expect(resolveAdminMode('view', { isAdmin: true, onAir: true })).toBe('view');
  });

  it('lands an admin in Winners while the show is on air, and in View otherwise', () => {
    expect(resolveAdminMode(undefined, { isAdmin: true, onAir: true })).toBe('winners');
    expect(resolveAdminMode(undefined, { isAdmin: true, onAir: false })).toBe('view');
  });

  it('treats a mode it does not know as no mode', () => {
    expect(resolveAdminMode('explore', { isAdmin: true, onAir: false })).toBe('view');
    expect(resolveAdminMode('Winners', { isAdmin: true, onAir: true })).toBe('winners');
    expect(resolveAdminMode('Winners', { isAdmin: true, onAir: false })).toBe('view');
  });
});
