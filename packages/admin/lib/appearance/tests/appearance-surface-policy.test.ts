import { describe, expect, it } from 'vitest';
import { AppearanceSurfacePolicy } from '@/lib/appearance/appearance-surface-policy';

describe('AppearanceSurfacePolicy.isPathAllowed', () => {
  it('allows every path when no surfaces are declared (legacy passthrough)', () => {
    expect(AppearanceSurfacePolicy.isPathAllowed(undefined, '/alpha/pages/1')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(undefined, '/anything')).toBe(true);
  });

  it('default-denies unlisted routes when surfaces are declared', () => {
    const surfaces = { plugins: ['beta', 'alpha'], paths: ['/my', '/settings/integrations'] };
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/gamma/pages/1')).toBe(false);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/delta')).toBe(false);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/settings/general')).toBe(false);
  });

  it('allows a listed plugin whose pages are not under /<slug>/', () => {
    // The hub plugin registers `/hub-clients`, `/hub-projects`, … — an appearance that allowed the
    // plugin still refused every one of its pages while this matched the segment only for equality.
    const surfaces = { plugins: ['beta'] };
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/beta-clients')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/beta-projects/12')).toBe(true);
    // Still a boundary, not a prefix free-for-all: another plugin's area is not swept in.
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/betamax')).toBe(false);
  });

  it('allows listed plugin areas by first segment', () => {
    const surfaces = { plugins: ['beta', 'alpha'] };
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/beta')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/beta/affiliates')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/alpha/orders')).toBe(true);
    // segment-boundary, not substring: '/betax' must NOT match plugin 'beta'
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/betax')).toBe(false);
  });

  it('allows listed path prefixes at a segment boundary', () => {
    const surfaces = { plugins: [], paths: ['/my', '/settings/integrations'] };
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/my')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/my/team')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/settings/integrations')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/settings/integrations/stripe')).toBe(true);
    // '/mystuff' must NOT match prefix '/my'
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/mystuff')).toBe(false);
    // sibling under /settings is denied
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/settings/general')).toBe(false);
  });

  it('always allows the landing and the appearance-settings escape hatch', () => {
    const surfaces = { plugins: [], paths: [] };
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/settings/appearance')).toBe(true);
  });

  it('always allows the way IN, whatever the allowlist says', () => {
    // Containment decides which of the admin's areas a skin presents. It has no business deciding
    // whether the sign-in exists: with these routes contained, `AppearanceShellHost` passed `null` for
    // the page and a workspace domain served a blank login.
    const surfaces = { plugins: [], paths: [] };
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/login')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/forgot-password')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/reset-password')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/reset-password/abc123')).toBe(true);
    // Still a segment-boundary match, not a prefix free-for-all.
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/loginsomething')).toBe(false);
  });

  it('ignores query/hash and a trailing slash', () => {
    const surfaces = { plugins: ['beta'] };
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/beta/affiliates?tab=x')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/beta/')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/alpha/#frag')).toBe(false);
  });
});
