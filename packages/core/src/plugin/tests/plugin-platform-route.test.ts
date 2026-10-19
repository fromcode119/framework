import { describe, expect, it } from 'vitest';
import { ApiPathUtils } from '@core/api/api-path-utils';
import { PluginPlatformRoute } from '@core/plugin/context/plugin-platform-route';

const base = ApiPathUtils.pluginPath('').replace(/\/+$/, '');

describe('PluginPlatformRoute.isPlatformRequest', () => {
  it('matches the reserved segment under a plugin, in any letter case', () => {
    expect(PluginPlatformRoute.isPlatformRequest(`${base}/meta/platform/webhook`)).toBe(true);
    expect(PluginPlatformRoute.isPlatformRequest(`${base}/meta/PLATFORM/webhook?x=1`)).toBe(true);
    expect(PluginPlatformRoute.isPlatformRequest(`${base.toUpperCase()}/meta/Platform/webhook`)).toBe(true);
  });

  it('does not match the bare segment, another segment, or a path outside the plugins base', () => {
    expect(PluginPlatformRoute.isPlatformRequest(`${base}/meta/platform`)).toBe(false);
    expect(PluginPlatformRoute.isPlatformRequest(`${base}/meta/platform/`)).toBe(false);
    expect(PluginPlatformRoute.isPlatformRequest(`${base}/meta/orders/platform/x`)).toBe(false);
    expect(PluginPlatformRoute.isPlatformRequest('/platform/meta/platform/x')).toBe(false);
  });
});

describe('PluginPlatformRoute.assertRegistration', () => {
  const declared = { platform: true } as any;

  it('refuses a non-platform route or middleware under the reserved segment, in any case', () => {
    expect(() => PluginPlatformRoute.assertRegistration('meta', true, 'Platform/hook', undefined, 'get')).toThrow(/reserved/);
    expect(() => PluginPlatformRoute.assertRegistration('meta', true, 'platform/hook', declared, 'use')).toThrow(/reserved/);
  });

  it('refuses a platform route outside the segment or from a plugin without a platform part', () => {
    expect(() => PluginPlatformRoute.assertRegistration('meta', true, 'hook', declared, 'post')).toThrow(/must start/);
    expect(() => PluginPlatformRoute.assertRegistration('meta', false, 'platform/hook', declared, 'post')).toThrow(/Security Violation/);
  });

  it('accepts a declared platform route from a platform plugin', () => {
    expect(() => PluginPlatformRoute.assertRegistration('meta', true, 'platform/hook', declared, 'post')).not.toThrow();
  });
});

describe('PluginPlatformRoute.isExemptRequest', () => {
  it('exempts only plugins that registered a platform route', () => {
    expect(PluginPlatformRoute.isExemptRequest(`${base}/orders-only/platform/hook`)).toBe(false);
    PluginPlatformRoute.assertRegistration('exempt-me', true, 'platform/hook', { platform: true } as any, 'post');
    expect(PluginPlatformRoute.isExemptRequest(`${base}/exempt-me/platform/hook`)).toBe(true);
    expect(PluginPlatformRoute.isExemptRequest(`${base}/EXEMPT-ME/Platform/hook`)).toBe(true);
    expect(PluginPlatformRoute.isExemptRequest(`${base}/exempt-me/orders`)).toBe(false);
  });
});
