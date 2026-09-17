import { describe, expect, it } from 'vitest';
import { RateLimitSettingsUtils } from '@api/utils/rate-limit-settings-utils';
import { CloudflareEdgeProvider } from '@fromcode119/core';

/**
 * `resolveNetworkEdgeRanges` used to be Cloudflare-only, stored under `rate_limit_cloudflare_edge_ranges`.
 * Renaming it to the generic `rate_limit_edge_provider_ranges` must not silently discard a range an
 * operator had already declared under the old key — that is the exact "removing a settings field
 * wipes plugin settings" failure class this codebase has been burned by before.
 */
describe('RateLimitSettingsUtils.resolveNetworkEdgeRanges', () => {
  it('reads the new key when it has been saved, ignoring the legacy one entirely', () => {
    const settingsCache = new Map([
      ['rate_limit_edge_provider_ranges', JSON.stringify({ cloudflare: '1.2.3.0/24' })],
      ['rate_limit_cloudflare_edge_ranges', '9.9.9.0/24'],
    ]);

    const result = RateLimitSettingsUtils.resolveNetworkEdgeRanges(settingsCache);

    expect(result[CloudflareEdgeProvider.KEY]).toEqual(['1.2.3.0/24']);
  });

  it('falls back to the legacy key as this provider\'s extra ranges when the new key was never saved', () => {
    const settingsCache = new Map([
      ['rate_limit_cloudflare_edge_ranges', '9.9.9.0/24, 8.8.8.0/24'],
    ]);

    const result = RateLimitSettingsUtils.resolveNetworkEdgeRanges(settingsCache);

    expect(result[CloudflareEdgeProvider.KEY]).toEqual(['9.9.9.0/24', '8.8.8.0/24']);
  });

  it('falls through to the hardcoded seed when neither key was ever saved', () => {
    const result = RateLimitSettingsUtils.resolveNetworkEdgeRanges(new Map());

    expect(result[CloudflareEdgeProvider.KEY]).toBeDefined();
    expect(result[CloudflareEdgeProvider.KEY].length).toBeGreaterThan(0);
  });

  it('an explicit blank value under the new key means "no additions", not "fall back to legacy"', () => {
    const settingsCache = new Map([
      ['rate_limit_edge_provider_ranges', ''],
      ['rate_limit_cloudflare_edge_ranges', '9.9.9.0/24'],
    ]);

    const result = RateLimitSettingsUtils.resolveNetworkEdgeRanges(settingsCache);

    expect(result).toEqual({});
  });

  it('malformed JSON under the new key fails safe to no additions, not to the legacy key', () => {
    const settingsCache = new Map([
      ['rate_limit_edge_provider_ranges', 'not json'],
      ['rate_limit_cloudflare_edge_ranges', '9.9.9.0/24'],
    ]);

    const result = RateLimitSettingsUtils.resolveNetworkEdgeRanges(settingsCache);

    expect(result).toEqual({});
  });
});
