import { describe, expect, it } from 'vitest';
import { ThemeContextProxy } from '../theme';

describe('ThemeContextProxy', () => {
  it('returns current plugin settings from active theme config', async () => {
    const proxy = ThemeContextProxy.createThemeProxy(
      { manifest: { slug: 'forms' } } as any,
      {
        themeManager: {
          getActiveThemeManifest: () => ({ slug: 'starter' }),
          getThemeConfig: async () => ({
            settings: {
              forms: {
                contactFormDefaults: {
                  title: 'Contact',
                },
              },
            },
          }),
        },
      } as any,
    );

    await expect(proxy.getCurrentPluginSettings()).resolves.toEqual({
      contactFormDefaults: {
        title: 'Contact',
      },
    });
  });

  it('parses serialized theme config objects', async () => {
    const proxy = ThemeContextProxy.createThemeProxy(
      { manifest: { slug: 'forms' } } as any,
      {
        themeManager: {
          getActiveThemeManifest: () => ({ slug: 'starter' }),
          getThemeConfig: async () => JSON.stringify({
            settings: {
              forms: {
                notificationEmail: 'hello@example.com',
              },
            },
          }),
        },
      } as any,
    );

    await expect(proxy.getCurrentPluginSettings()).resolves.toEqual({
      notificationEmail: 'hello@example.com',
    });
  });
});
