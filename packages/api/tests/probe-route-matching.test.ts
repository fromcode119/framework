import { describe, expect, it } from 'vitest';
import { ServerMiddlewareSetup } from '@api/server/server-middleware-setup';

/**
 * The probe exemption skips tenancy entirely, so anything it matches runs with NO tenant bound.
 * It therefore has to match the framework's own two probes and nothing else.
 */
describe('ServerMiddlewareSetup.isProbeRoute', () => {
  const isProbe = (path: string) => (ServerMiddlewareSetup.prototype as any)
    .isProbeRoute.call({}, { path });

  it('matches the framework health and ready probes, versioned or not', () => {
    expect(isProbe('/health')).toBe(true);
    expect(isProbe('/api/v1/health')).toBe(true);
    expect(isProbe('/ready')).toBe(true);
    expect(isProbe('/api/v1/ready')).toBe(true);
    expect(isProbe('/api/v1/health/')).toBe(true);
  });

  it('does NOT match a plugin route that merely ends in /health', () => {
    // `context.api.health(...)` is a first-class part of the plugin API, so the old suffix match
    // exempted EVERY plugin health probe from tenancy: it ran with no tenant bound, and the tenant
    // gate then refused it. Found while verifying T2, on the first such route that was tried.
    expect(isProbe('/api/v1/plugins/seo/health')).toBe(false);
    expect(isProbe('/api/v1/plugins/ecommerce/health')).toBe(false);
    expect(isProbe('/api/v1/plugins/anything/ready')).toBe(false);
  });

  it('does not match a content path that happens to end in the same word', () => {
    expect(isProbe('/api/v1/pages/health')).toBe(false);
    expect(isProbe('/api/v1/collections/articles/health')).toBe(false);
  });
});
