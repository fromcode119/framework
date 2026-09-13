import http from 'http';
import { describe, expect, it } from 'vitest';
import { GatewayPlainListenerPolicy } from '@cli/services/gateway-plain-listener-policy';

/**
 * What the plain-HTTP listener does once this process holds the certificates.
 *
 * Two of these are not style choices — they are the difference between a working platform and an
 * outage. Redirecting the challenge path fails every certificate order; redirecting a request that
 * an edge already terminated loops it forever.
 */
describe('GatewayPlainListenerPolicy', () => {
  const request = (url: string, headers: Record<string, string> = {}): http.IncomingMessage =>
    ({ url, headers: { host: 'shop.test', ...headers } }) as unknown as http.IncomingMessage;

  describe('before this process terminates TLS', () => {
    const policy = new GatewayPlainListenerPolicy(false);

    it('redirects nothing — something in front is terminating, and every request arrives plain', () => {
      expect(policy.redirectFor(request('/'))).toBeNull();
      expect(policy.redirectFor(request('/anything'))).toBeNull();
    });
  });

  describe('once this process terminates TLS', () => {
    const policy = new GatewayPlainListenerPolicy(true);

    it('sends ordinary traffic to HTTPS, keeping the path and query', () => {
      expect(policy.redirectFor(request('/shop?page=2'))).toBe('https://shop.test/shop?page=2');
    });

    it('does NOT redirect the ACME challenge — redirecting it fails every certificate order', () => {
      expect(policy.redirectFor(request('/.well-known/acme-challenge/tok3n'))).toBeNull();
    });

    it('does NOT redirect a request an edge already terminated — that is an infinite loop', () => {
      // The edge terminates TLS and forwards here over plain HTTP. Telling it to go to HTTPS sends
      // it back to the edge, which terminates and forwards it here again, forever — on every host.
      expect(policy.redirectFor(request('/', { 'x-forwarded-proto': 'https' }))).toBeNull();
    });

    it('still redirects when the edge says the request arrived over http', () => {
      expect(policy.redirectFor(request('/', { 'x-forwarded-proto': 'http' }))).toBe('https://shop.test/');
    });

    it('reads only the first hop of a chained x-forwarded-proto', () => {
      expect(policy.redirectFor(request('/', { 'x-forwarded-proto': 'https, http' }))).toBeNull();
    });

    it('drops the port, so a redirect never points at the internal one', () => {
      expect(policy.redirectFor(request('/', { host: 'shop.test:8085' }))).toBe('https://shop.test/');
    });

    it('leaves a request with no host alone rather than redirecting it nowhere', () => {
      const headerless = { url: '/', headers: {} } as unknown as http.IncomingMessage;
      expect(policy.redirectFor(headerless)).toBeNull();
    });

    it('prefers x-forwarded-host, which is the name the visitor actually typed', () => {
      expect(policy.redirectFor(request('/', { 'x-forwarded-host': 'real.test' }))).toBe('https://real.test/');
    });
  });

  it('recognises the challenge prefix wherever it is asked about', () => {
    expect(GatewayPlainListenerPolicy.isChallengePath('/.well-known/acme-challenge/abc')).toBe(true);
    expect(GatewayPlainListenerPolicy.isChallengePath('/.well-known/other')).toBe(false);
    expect(GatewayPlainListenerPolicy.isChallengePath('/shop')).toBe(false);
  });
});
