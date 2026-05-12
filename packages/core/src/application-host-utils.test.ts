import { describe, expect, it } from 'vitest';
import { ApplicationHostUtils } from './application-host-utils';

describe('ApplicationHostUtils', () => {
  it('detects local development hostnames from urls and host headers', () => {
    expect(ApplicationHostUtils.isLocalDevelopmentHostname('http://frontend.framework.local')).toBe(true);
    expect(ApplicationHostUtils.isLocalDevelopmentHostname('api.framework.local:3000')).toBe(true);
    expect(ApplicationHostUtils.isLocalDevelopmentHostname('localhost:4000')).toBe(true);
    expect(ApplicationHostUtils.isLocalDevelopmentHostname('127.0.0.1:8080')).toBe(true);
    expect(ApplicationHostUtils.isLocalDevelopmentHostname('[::1]:3000')).toBe(true);
  });

  it('rejects non-local hostnames', () => {
    expect(ApplicationHostUtils.isLocalDevelopmentHostname('https://vselenskiportal88.com')).toBe(false);
    expect(ApplicationHostUtils.isLocalDevelopmentHostname('fromcode.com')).toBe(false);
  });

  it('normalizes hostnames without ports', () => {
    expect(ApplicationHostUtils.normalizeHostname('api.framework.local:3000')).toBe('api.framework.local');
    expect(ApplicationHostUtils.normalizeHostname('127.0.0.1:4000')).toBe('127.0.0.1');
    expect(ApplicationHostUtils.normalizeHostname('[::1]:3000')).toBe('::1');
  });

  it('returns the shared local allowed domains list', () => {
    expect(ApplicationHostUtils.getLocalAllowedDomains()).toEqual(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
  });
});
