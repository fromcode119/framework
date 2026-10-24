import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsoleMountUtils } from '@core/utils/console-mount-utils';
import { ConsoleMountConstants } from '@core/constants/console-mount.constants';
import { RuntimeLocationUtils } from '@core/utils/runtime-location-utils';

/** A console document mounted at `mount`, viewed at `href`. */
const mountedAt = (mount: string, href: string): void => {
  vi.stubGlobal('document', {
    documentElement: {
      getAttribute: (name: string) => (name === ConsoleMountConstants.ATTRIBUTE ? mount : null),
    },
  });
  vi.stubGlobal('window', { location: { href } });
};

describe('ConsoleMountUtils', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts only a console-path shape', () => {
    expect(ConsoleMountUtils.sanitize('/Admin/')).toBe('/admin');
    expect(ConsoleMountUtils.sanitize('/team/console')).toBe('/team/console');
    expect(ConsoleMountUtils.sanitize('admin')).toBe('');
    expect(ConsoleMountUtils.sanitize('//evil.test')).toBe('');
    expect(ConsoleMountUtils.sanitize('/a b')).toBe('');
    expect(ConsoleMountUtils.sanitize(undefined)).toBe('');
  });

  it('prefixes root-relative paths once', () => {
    expect(ConsoleMountUtils.prefix('/settings', '/backend')).toBe('/backend/settings');
    expect(ConsoleMountUtils.prefix('/', '/backend')).toBe('/backend');
    expect(ConsoleMountUtils.prefix('/backend/settings', '/backend')).toBe('/backend/settings');
    expect(ConsoleMountUtils.prefix('/backend', '/backend')).toBe('/backend');
    expect(ConsoleMountUtils.prefix('/backend?x=1', '/backend')).toBe('/backend?x=1');
    // A route that merely starts with the same letters is not under the mount.
    expect(ConsoleMountUtils.prefix('/backends', '/backend')).toBe('/backend/backends');
  });

  it('leaves addresses that already say where they go', () => {
    expect(ConsoleMountUtils.prefix('https://x.test/a', '/backend')).toBe('https://x.test/a');
    expect(ConsoleMountUtils.prefix('//x.test/a', '/backend')).toBe('//x.test/a');
    expect(ConsoleMountUtils.prefix('#top', '/backend')).toBe('#top');
    expect(ConsoleMountUtils.prefix('/settings', '')).toBe('/settings');
  });

  it('strips the mount back off', () => {
    expect(ConsoleMountUtils.strip('/backend/settings', '/backend')).toBe('/settings');
    expect(ConsoleMountUtils.strip('/backend', '/backend')).toBe('/');
    expect(ConsoleMountUtils.strip('/backend?x=1', '/backend')).toBe('/?x=1');
    expect(ConsoleMountUtils.strip('/backends', '/backend')).toBe('/backends');
  });

  it('reads nothing on a server', () => {
    expect(ConsoleMountUtils.current()).toBe('');
    expect(ConsoleMountUtils.prefix('/settings')).toBe('/settings');
  });

  it('reads the mount the console document declares', () => {
    mountedAt('/backend', 'https://replybird.test/backend/settings');
    expect(ConsoleMountUtils.current()).toBe('/backend');
    expect(ConsoleMountUtils.prefix('/settings')).toBe('/backend/settings');
  });

  it('puts the mount in front of every admin path on a mounted root-base console', () => {
    const adminUrl = process.env.ADMIN_URL;
    const publicBasePath = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH;
    process.env.ADMIN_URL = 'https://console.test';
    process.env.NEXT_PUBLIC_ADMIN_BASE_PATH = '';
    try {
      mountedAt('/backend', 'https://replybird.test/backend/plugins/x');
      expect(RuntimeLocationUtils.toAdminPath('/plugins/x')).toBe('/backend/plugins/x');
      expect(RuntimeLocationUtils.toAdminPath('/backend/plugins/x')).toBe('/backend/plugins/x');
    } finally {
      process.env.ADMIN_URL = adminUrl;
      process.env.NEXT_PUBLIC_ADMIN_BASE_PATH = publicBasePath;
    }
  });
});
