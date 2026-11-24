import { afterEach, describe, expect, it } from 'vitest';
import type http from 'http';
import { InternalServiceAuth } from '@fromcode119/core';
import { GatewayHealthAccess } from '@cli/services/gateway/gateway-health-access';

/** The health path tells the inside it is up and tells the internet nothing. */
describe('GatewayHealthAccess', () => {
  const previous = process.env.INTERNAL_SERVICE_SECRET;
  afterEach(() => { process.env.INTERNAL_SERVICE_SECRET = previous; });
  const request = (address: string, headers: Record<string, string> = {}) => ({ socket: { remoteAddress: address }, headers }) as unknown as http.IncomingMessage;
  const access = new GatewayHealthAccess(() => ['46.224.79.0/24']);

  it('answers a visitor from the internet with nothing', () => {
    expect(access.allowed(request('203.0.113.7'))).toBe(false);
    expect(access.allowed(request('::ffff:203.0.113.7'))).toBe(false);
  });

  it('says only "up" to this machine, the private network and a Trusted relay', () => {
    for (const address of ['127.0.0.1', '::1', '172.18.0.5', '10.1.2.3', '::ffff:192.168.1.4', '46.224.79.242']) {
      expect(access.allowed(request(address))).toBe(true);
      expect(access.detailed(request(address))).toBe(false);
    }
  });

  it('gives the details only to a caller holding the internal secret, wherever it calls from', () => {
    process.env.INTERNAL_SERVICE_SECRET = 'health-test-secret-0123456789';
    const withSecret = request('203.0.113.7', { [InternalServiceAuth.HEADER]: 'health-test-secret-0123456789' });
    expect(access.detailed(withSecret)).toBe(true);
    expect(access.allowed(withSecret)).toBe(true);
    expect(access.detailed(request('172.18.0.5', { [InternalServiceAuth.HEADER]: 'wrong' }))).toBe(false);
  });
});
