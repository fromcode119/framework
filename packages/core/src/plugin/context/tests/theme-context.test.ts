import { describe, expect, it } from 'vitest';
import { ThemeContextProxy } from '@core/plugin/context/theme';

describe('ThemeContextProxy', () => {
  it('returns current plugin settings from active theme config', async () => {
    const proxy = ThemeContextProxy.createThemeProxy(
      { manifest: { slug: 'theta' } } as any,
      {
        themeManager: {
          getActiveThemeManifest: () => ({ slug: 'starter' }),
          getThemeConfig: async () => ({
            settings: {
              theta: {
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
      { manifest: { slug: 'theta' } } as any,
      {
        themeManager: {
          getActiveThemeManifest: () => ({ slug: 'starter' }),
          getThemeConfig: async () => JSON.stringify({
            settings: {
              theta: {
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
