import { describe, expect, it } from 'vitest';
import { ThemeConfigService } from '@core/theme/theme-config-service';

describe('ThemeConfigService.validateThemeConfig', () => {
  const service = new ThemeConfigService({}, new Map([['alpha', { slug: 'alpha' } as any]]));

  it('accepts the full body the theme settings page sends, nested settings included', () => {
    expect(() => service.validateThemeConfig('alpha', {
      variables: { siteName: 'Alpha' },
      layouts: { page: 'WideLayout' },
      settings: { ecommerceEmails: { customer: { title: 'Thanks', fields: ['orderNumber'] } }, previewUrl: 'https://a.test' },
    })).not.toThrow();
  });

  it('still rejects keys the page never writes', () => {
    expect(() => service.validateThemeConfig('alpha', { variables: {}, css: 'x' })).toThrow('Unknown theme config keys: css');
  });

  it('rejects a non-string variable or layout', () => {
    expect(() => service.validateThemeConfig('alpha', { variables: { siteName: 1 } })).toThrow('Theme variable "siteName" must be a string.');
    expect(() => service.validateThemeConfig('alpha', { layouts: { page: {} } })).toThrow('Theme layout "page" must be a string.');
  });

  it('rejects settings that are not a plain object', () => {
    expect(() => service.validateThemeConfig('alpha', { settings: [] })).toThrow('Theme settings must be a plain object.');
    expect(() => service.validateThemeConfig('alpha', { settings: '[object Object]' })).toThrow('Theme settings must be a plain object.');
  });
});
