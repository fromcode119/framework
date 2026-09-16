import { describe, expect, it } from 'vitest';
import { AdminUrlUtils } from '@/lib/url-utils';
import { SourcesRouteService } from '@/app/sources/sources-route-service';

/**
 * The Sources endpoints, pinned to the exact URLs they must produce.
 *
 * These paths used to be string literals here AND in the router, so the same path existed twice with
 * nothing tying the two together. Composing them from the shared segments removes the duplication —
 * and this suite exists because that refactor must be invisible: a path that shifts by one segment
 * breaks every call on the screen, and does it silently.
 *
 * Run through `normalizeRequestPath` because that is what the client actually sends. It prefixes a
 * bare path with the API version and leaves an already-prefixed one alone, so both the old spelling
 * and the new one had to land on the same URL — that idempotence is what makes this safe.
 */
const sent = (path: string) => AdminUrlUtils.normalizeRequestPath(path);

describe('the URLs the Sources screen calls', () => {
  it('lists and creates at the collection', () => {
    expect(sent(SourcesRouteService.list())).toBe('/api/v1/sources');
    expect(sent(SourcesRouteService.create())).toBe('/api/v1/sources');
  });

  it('addresses one source by KIND and slug', () => {
    expect(sent(SourcesRouteService.one('plugin', 'cms'))).toBe('/api/v1/sources/plugin/cms');
  });

  it('keeps the collection-level actions where they were', () => {
    expect(sent(SourcesRouteService.providers())).toBe('/api/v1/sources/providers');
    expect(sent(SourcesRouteService.buildAll())).toBe('/api/v1/sources/build');
    expect(sent(SourcesRouteService.checkUpdates())).toBe('/api/v1/sources/check-updates');
    expect(sent(SourcesRouteService.branches())).toBe('/api/v1/sources/branches');
    expect(sent(SourcesRouteService.inspect())).toBe('/api/v1/sources/inspect');
  });

  it('keeps the per-source actions where they were', () => {
    expect(sent(SourcesRouteService.buildOne('plugin', 'cms'))).toBe('/api/v1/sources/plugin/cms/build');
    expect(sent(SourcesRouteService.packageArchive('plugin', 'cms'))).toBe('/api/v1/sources/plugin/cms/package');
    expect(sent(SourcesRouteService.versions('plugin', 'cms'))).toBe('/api/v1/sources/plugin/cms/versions');
    expect(sent(SourcesRouteService.install('plugin', 'cms'))).toBe('/api/v1/sources/plugin/cms/install');
  });

  it('encodes a kind or slug that would otherwise change the path', () => {
    // A slug is operator-supplied. Without encoding, one containing a slash addresses a different route.
    expect(SourcesRouteService.one('plugin', 'a/b')).toContain('a%2Fb');
    expect(SourcesRouteService.one('the me', 'x')).toContain('the%20me');
  });

  it('is not double-prefixed — the composed path already carries the version', () => {
    // The guard that makes this refactor safe: `normalizeRequestPath` leaves an `/api/…` path alone.
    expect(sent(SourcesRouteService.list())).not.toContain('/api/v1/api/');
    expect(sent(SourcesRouteService.versions('plugin', 'cms'))).not.toContain('/v1/v1/');
  });
});
