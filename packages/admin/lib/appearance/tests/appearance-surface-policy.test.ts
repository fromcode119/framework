import { describe, expect, it } from 'vitest';
import { AppearanceSurfacePolicy } from '@/lib/appearance/appearance-surface-policy';

describe('AppearanceSurfacePolicy.isPathAllowed', () => {
  it('allows every path when no surfaces are declared (legacy passthrough)', () => {
    expect(AppearanceSurfacePolicy.isPathAllowed(undefined, '/cms/pages/1')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(undefined, '/anything')).toBe(true);
  });

  it('default-denies unlisted routes when surfaces are declared', () => {
    const surfaces = { plugins: ['mlm', 'ecommerce'], paths: ['/my', '/settings/integrations'] };
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/cms/pages/1')).toBe(false);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/seo')).toBe(false);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/settings/general')).toBe(false);
  });

  it('allows listed plugin areas by first segment', () => {
    const surfaces = { plugins: ['mlm', 'ecommerce'] };
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/mlm')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/mlm/affiliates')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/ecommerce/orders')).toBe(true);
    // segment-boundary, not substring: '/mlmx' must NOT match plugin 'mlm'
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/mlmx')).toBe(false);
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

  it('ignores query/hash and a trailing slash', () => {
    const surfaces = { plugins: ['mlm'] };
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/mlm/affiliates?tab=x')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/mlm/')).toBe(true);
    expect(AppearanceSurfacePolicy.isPathAllowed(surfaces, '/cms/#frag')).toBe(false);
  });
});
