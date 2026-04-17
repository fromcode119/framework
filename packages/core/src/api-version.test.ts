import { afterEach, describe, expect, it } from 'vitest';
import { ApiVersionUtils } from './api-version';

describe('ApiVersionUtils', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_VERSION;
    delete process.env.API_VERSION_PREFIX;
    delete process.env.DEFAULT_API_VERSION;
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.API_URL;
  });

  it('defaults to /api/v1 when no version env is set', () => {
    expect(ApiVersionUtils.prefix()).toBe('/api/v1');
  });

  it('uses API_VERSION_PREFIX when provided', () => {
    process.env.API_VERSION_PREFIX = 'v3';
    expect(ApiVersionUtils.prefix()).toBe('/api/v3');
  });

  it('normalizes numeric versions when prepending paths', () => {
    expect(ApiVersionUtils.withVersion('/users', '2')).toBe('/api/v2/users');
  });
});