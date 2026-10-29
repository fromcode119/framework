import { describe, it, expect } from 'vitest';
import type { IncomingMessage } from 'http';
import { ResponseCompressionPolicy } from '@core/security/response-compression-policy';
import { CookieConstants } from '@core/constants/cookie.constants';

const request = (headers: Record<string, string>, method = 'GET'): IncomingMessage =>
  ({ method, headers: { 'accept-encoding': 'gzip, br', ...headers } }) as unknown as IncomingMessage;

const big = 'x'.repeat(ResponseCompressionPolicy.MIN_COMPRESS_BYTES);

describe('ResponseCompressionPolicy', () => {
  it('compresses an anonymous GET that accepts gzip', () => {
    expect(ResponseCompressionPolicy.mayCompress(request({}))).toBe(true);
  });

  it('never compresses without gzip, or for anything but GET', () => {
    expect(ResponseCompressionPolicy.mayCompress(request({ 'accept-encoding': 'identity' }))).toBe(false);
    expect(ResponseCompressionPolicy.mayCompress(request({}, 'POST'))).toBe(false);
  });

  it('never compresses a request a browser sent with a session cookie', () => {
    expect(ResponseCompressionPolicy.mayCompress(request({ cookie: `${CookieConstants.AUTH_TOKEN}=session-value` }))).toBe(false);
  });

  it('treats a cleared session cookie as absent', () => {
    expect(ResponseCompressionPolicy.mayCompress(request({ cookie: `${CookieConstants.AUTH_TOKEN}=` }))).toBe(true);
  });

  it('compresses a bearer-token request, since no browser replays that header cross-site', () => {
    expect(ResponseCompressionPolicy.mayCompress(request({ authorization: 'Bearer abcdefghijklmnop' }))).toBe(true);
  });

  it('refuses a body that echoes the bearer token or a cookie value', () => {
    const secrets = ResponseCompressionPolicy.secrets(request({ authorization: 'Bearer abcdefghijklmnop', cookie: 'fc_csrf=csrf-value-123' }));
    expect(secrets).toEqual(['csrf-value-123', 'abcdefghijklmnop']);
    expect(ResponseCompressionPolicy.compressesBody(`${big}abcdefghijklmnop`, secrets)).toBe(false);
    expect(ResponseCompressionPolicy.compressesBody(`${big}csrf-value-123`, secrets)).toBe(false);
    expect(ResponseCompressionPolicy.compressesBody(big, secrets)).toBe(true);
  });

  it('leaves a body too small to pay for gzip alone', () => {
    expect(ResponseCompressionPolicy.compressesBody('{"a":1}', [])).toBe(false);
  });
});
