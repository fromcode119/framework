import { describe, expect, it } from 'vitest';
import { ThemeConfigService } from '@core/theme/theme-config-service';

const alpha = {
  slug: 'alpha',
  defaultLayout: 'page.default',
  layouts: [{ name: 'page.default', label: 'Default' }, { name: 'page.canvas', label: 'Canvas' }],
} as any;

describe('ThemeConfigService.validateThemeConfig', () => {
  const service = new ThemeConfigService({}, new Map([['alpha', alpha]]));

  it('accepts the full body the theme settings page sends, nested settings included', () => {
    expect(() => service.validateThemeConfig('alpha', {
      variables: { siteName: 'Alpha' },
      defaultLayout: 'page.canvas',
      settings: { emailCopy: { customer: { title: 'Thanks', fields: ['reference'] } }, previewUrl: 'https://a.test' },
    })).not.toThrow();
  });

  it('accepts an empty default layout — the theme default then applies', () => {
    expect(() => service.validateThemeConfig('alpha', { defaultLayout: '' })).not.toThrow();
  });

  it('rejects a default layout the theme does not declare', () => {
    expect(() => service.validateThemeConfig('alpha', { defaultLayout: 'page.missing' })).toThrow('Theme "alpha" declares no layout named "page.missing".');
    expect(() => service.validateThemeConfig('alpha', { defaultLayout: 3 })).toThrow('Theme default layout must be a string.');
  });

  it('still rejects keys the page never writes, including the retired layouts map', () => {
    expect(() => service.validateThemeConfig('alpha', { variables: {}, css: 'x' })).toThrow('Unknown theme config keys: css');
    expect(() => service.validateThemeConfig('alpha', { layouts: { 'core/layouts/Default': 'page.canvas' } })).toThrow('Unknown theme config keys: layouts');
  });

  it('rejects a non-string variable', () => {
    expect(() => service.validateThemeConfig('alpha', { variables: { siteName: 1 } })).toThrow('Theme variable "siteName" must be a string.');
  });

  it('rejects settings that are not a plain object', () => {
    expect(() => service.validateThemeConfig('alpha', { settings: [] })).toThrow('Theme settings must be a plain object.');
    expect(() => service.validateThemeConfig('alpha', { settings: '[object Object]' })).toThrow('Theme settings must be a plain object.');
  });
});

describe('ThemeConfigService.resolveDefaultLayout', () => {
  it('uses the site choice when the theme declares it', () => {
    expect(ThemeConfigService.resolveDefaultLayout(alpha, { defaultLayout: 'page.canvas' })).toBe('page.canvas');
  });

  it('falls back to the theme default when the site chose nothing', () => {
    expect(ThemeConfigService.resolveDefaultLayout(alpha, {})).toBe('page.default');
  });

  it('does not honour a choice the theme no longer declares', () => {
    expect(ThemeConfigService.resolveDefaultLayout(alpha, { defaultLayout: 'page.gone' })).toBe('page.default');
  });
});

describe('ThemeConfigService.getFrontendMetadata', () => {
  it('publishes the site default layout to the storefront', async () => {
    const service = new ThemeConfigService({}, new Map([['alpha', alpha]]));
    const metadata = await service.getFrontendMetadata({ ...alpha, ui: {} }, {}, { defaultLayout: 'page.canvas' });
    expect(metadata.activeTheme?.defaultLayout).toBe('page.canvas');
  });
});
