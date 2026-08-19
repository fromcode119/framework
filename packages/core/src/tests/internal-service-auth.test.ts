import { afterEach, describe, expect, it } from 'vitest';
import { InternalServiceAuth } from '@core/security/internal-service-auth';

/**
 * This secret is the ONLY thing standing in front of the admin's and frontend's restart endpoints,
 * both of which are reachable wherever those apps are. The two properties that matter are that an
 * unconfigured install rejects everything, and that a wrong value never passes.
 */
describe('InternalServiceAuth', () => {
  const original = process.env[InternalServiceAuth.ENV_KEY];

  afterEach(() => {
    if (original === undefined) delete process.env[InternalServiceAuth.ENV_KEY];
    else process.env[InternalServiceAuth.ENV_KEY] = original;
  });

  it('rejects every value when no secret is configured', () => {
    delete process.env[InternalServiceAuth.ENV_KEY];
    expect(InternalServiceAuth.isConfigured()).toBe(false);
    expect(InternalServiceAuth.authorize('')).toBe(false);
    expect(InternalServiceAuth.authorize(null)).toBe(false);
    expect(InternalServiceAuth.authorize('anything')).toBe(false);
  });

  it('accepts the configured secret and nothing else', () => {
    process.env[InternalServiceAuth.ENV_KEY] = 's3cret-value';
    expect(InternalServiceAuth.authorize('s3cret-value')).toBe(true);
    expect(InternalServiceAuth.authorize('s3cret-valuE')).toBe(false);
    expect(InternalServiceAuth.authorize('s3cret-value ')).toBe(false);
    expect(InternalServiceAuth.authorize('s3cret')).toBe(false);
    expect(InternalServiceAuth.authorize(undefined)).toBe(false);
  });

  it('sends the secret under the header the receiving apps read', () => {
    process.env[InternalServiceAuth.ENV_KEY] = 's3cret-value';
    expect(InternalServiceAuth.requestHeaders()).toEqual({ [InternalServiceAuth.HEADER]: 's3cret-value' });
  });
});
