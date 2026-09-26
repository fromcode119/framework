import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemePreviewUtils } from '@/lib/theme-preview-utils';

/**
 * A theme's "Open Site" link. With no URL of its own it opened the CONSOLE on production — the
 * fallback guessed from the console's hostname. The bound site's own storefront now comes first,
 * after a URL the operator configured on the theme.
 */
const ENV_KEYS = ['FRONTEND_URL', 'NEXT_PUBLIC_SITE_URL', 'PUBLIC_APP_URL', 'APP_URL'] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => { for (const key of ENV_KEYS) { saved[key] = process.env[key]; delete process.env[key]; } });
afterEach(() => { for (const key of ENV_KEYS) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } });

describe('ThemePreviewUtils.normalizePreviewUrl', () => {
  it('opens the bound site’s storefront when the theme names no URL', () => {
    expect(ThemePreviewUtils.normalizePreviewUrl('', 'https://theme-default.example', {}, 'https://shop.example.com'))
      .toBe('https://shop.example.com');
  });

  it('keeps a URL the operator configured on the theme', () => {
    expect(ThemePreviewUtils.normalizePreviewUrl('https://configured.example', '', {}, 'https://shop.example.com'))
      .toBe('https://configured.example');
  });

  it('resolves as before with no site bound', () => {
    expect(ThemePreviewUtils.normalizePreviewUrl('', 'https://theme-default.example', {}, ''))
      .toBe('https://theme-default.example');
  });
});
