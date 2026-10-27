import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiVersionUtils } from '@core/api-version';

describe('ApiVersionUtils', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('mounts the api at /api, with no version segment', () => {
    expect(ApiVersionUtils.prefix()).toBe('/api');
    expect(ApiVersionUtils.withVersion('/users')).toBe('/api/users');
    expect(ApiVersionUtils.withVersion('users')).toBe('/api/users');
  });

  it('ignores the retired version variables', () => {
    vi.stubEnv('API_VERSION_PREFIX', 'v1');
    vi.stubEnv('NEXT_PUBLIC_API_VERSION', 'v2');
    vi.stubEnv('DEFAULT_API_VERSION', 'v3');
    expect(ApiVersionUtils.prefix()).toBe('/api');
  });

  it('follows a configured base path', () => {
    vi.stubEnv('API_URL', 'https://example.com/mapi');
    expect(ApiVersionUtils.prefix()).toBe('/mapi');
  });
});
