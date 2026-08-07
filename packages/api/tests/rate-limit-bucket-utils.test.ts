import { SystemConstants } from '@fromcode119/core';
import { RateLimitBucketUtils } from '@api/utils/rate-limit-bucket-utils';
import { RateLimitSettingsUtils } from '@api/utils/rate-limit-settings-utils';

/** A JWT-shaped token — the structural gate the bucket rules use, not a real credential. */
const TOKEN = 'aaaaaaaaaa.bbbbbbbbbb.cccccccccc';

/** The storefront renderer: a container on the docker network, calling the API with no identity. */
const renderRequest = (overrides: Record<string, unknown> = {}) => ({
  ip: '172.18.0.7',
  method: 'GET',
  headers: {},
  socket: { remoteAddress: '::ffff:172.18.0.7' },
  path: '/v1/system/resolve',
  ...overrides,
});

/** A public visitor arriving through the edge proxy, which itself sits on the private network. */
const visitorRequest = (overrides: Record<string, unknown> = {}) => ({
  ip: '203.0.113.9',
  method: 'GET',
  headers: {},
  socket: { remoteAddress: '::ffff:172.18.0.2' },
  path: '/v1/system/resolve',
  ...overrides,
});

const settingsWith = (entries: Record<string, string>): Map<string, string> => new Map(Object.entries(entries));

describe('RateLimitBucketUtils — internal service bucket', () => {
  it('gives the storefront renderer its own bucket, keyed per calling service', () => {
    expect(RateLimitBucketUtils.resolveKey(renderRequest())).toBe('internal:172.18.0.7');
    expect(RateLimitBucketUtils.resolveLimit(renderRequest()))
      .toBe(Number(RateLimitSettingsUtils.DEFAULT_MAX_REQUESTS_INTERNAL));
  });

  it('keeps two internal services in separate buckets', () => {
    expect(RateLimitBucketUtils.resolveKey(renderRequest({ ip: '172.18.0.9', socket: { remoteAddress: '172.18.0.9' } })))
      .toBe('internal:172.18.0.9');
  });

  it('does NOT let the edge proxy launder a public visitor into the internal bucket', () => {
    expect(RateLimitBucketUtils.resolveKey(visitorRequest())).toBe('ip:203.0.113.9');
    expect(RateLimitBucketUtils.resolveLimit(visitorRequest()))
      .toBe(Number(RateLimitSettingsUtils.DEFAULT_MAX_REQUESTS));
  });

  it('ignores a header claiming to be an internal client', () => {
    const spoofed = visitorRequest({ headers: { 'x-framework-client': 'frontend-ssr', 'x-internal': 'true' } });
    expect(RateLimitBucketUtils.resolveKey(spoofed)).toBe('ip:203.0.113.9');
  });

  it('leaves token-bearing traffic in its own ip+token bucket', () => {
    const signedIn = renderRequest({ headers: { authorization: `Bearer ${TOKEN}` } });
    expect(RateLimitBucketUtils.resolveKey(signedIn)).toMatch(/^tok:172\.18\.0\.7:/);
    expect(RateLimitBucketUtils.resolveLimit(signedIn))
      .toBe(Number(RateLimitSettingsUtils.DEFAULT_MAX_REQUESTS_AUTHENTICATED));
  });

  it('leaves the admin bootstrap groups untouched', () => {
    const bootstrap = renderRequest({ headers: { 'x-framework-client': 'admin-ui' }, path: '/v1/auth/status' });
    expect(RateLimitBucketUtils.resolveKey(bootstrap)).toBe('admin-bootstrap:172.18.0.7:auth-status');
  });

  it('honours a narrowed allowlist', () => {
    const settings = settingsWith({ [SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS]: '172.18.0.7' });
    expect(RateLimitBucketUtils.resolveKey(renderRequest(), settings)).toBe('internal:172.18.0.7');
    expect(RateLimitBucketUtils.resolveKey(renderRequest({ ip: '172.18.0.8', socket: { remoteAddress: '172.18.0.8' } }), settings))
      .toBe('ip:172.18.0.8');
  });

  it('treats a CLEARED allowlist as "nothing is internal" instead of falling back to the seed', () => {
    const settings = settingsWith({ [SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS]: '' });
    expect(RateLimitBucketUtils.isInternalServiceRequest(renderRequest(), settings)).toBe(false);
    expect(RateLimitBucketUtils.resolveKey(renderRequest(), settings)).toBe('ip:172.18.0.7');
    expect(RateLimitBucketUtils.resolveLimit(renderRequest(), settings))
      .toBe(Number(RateLimitSettingsUtils.DEFAULT_MAX_REQUESTS));
  });

  it('spends the operator-configured internal budget', () => {
    const settings = settingsWith({ [SystemConstants.META_KEY.RATE_LIMIT_MAX_INTERNAL]: '250' });
    expect(RateLimitBucketUtils.resolveLimit(renderRequest(), settings)).toBe(250);
  });
});
