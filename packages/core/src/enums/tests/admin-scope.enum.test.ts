import { describe, expect, it } from 'vitest';
import { AdminScope } from '../admin-scope.enum';

/**
 * The reason this is an enum and not two string literals.
 *
 * `scope` crosses a JSON boundary, so what the admin receives is a plain string — and a string is
 * never equal to an enum member. That comparison does not fail loudly; it is silently always false,
 * which here would mean a site's dashboard quietly presenting itself as the platform's. `resolve` is
 * the single place the string becomes a member.
 */
describe('AdminScope', () => {
  it('serialises to the wire value the API sends', () => {
    expect(JSON.stringify({ scope: AdminScope.SITE })).toBe('{"scope":"site"}');
    expect(JSON.stringify({ scope: AdminScope.PLATFORM })).toBe('{"scope":"platform"}');
  });

  it('resolves a received string back to the same member', () => {
    const received = JSON.parse(JSON.stringify({ scope: AdminScope.SITE })).scope;

    expect(received).not.toBe(AdminScope.SITE); // the trap itself: a string, not the member
    expect(AdminScope.resolve(received)).toBe(AdminScope.SITE);
    expect(AdminScope.resolve(received)!.isSite).toBe(true);
  });

  it('answers undefined for a payload that named no scope, rather than defaulting', () => {
    expect(AdminScope.resolve(undefined)).toBeUndefined();
    expect(AdminScope.resolve('')).toBeUndefined();
    expect(AdminScope.resolve('tenant')).toBeUndefined();
  });

  it('accepts a member unchanged, so a caller may pass either', () => {
    expect(AdminScope.resolve(AdminScope.PLATFORM)).toBe(AdminScope.PLATFORM);
  });
});
