import { describe, expect, it, vi } from 'vitest';
import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';
import { PluginExtensionArchiveInstaller } from '@core/plugin/services/installation/plugin-extension-archive-installer';

/**
 * Which root a package is written into.
 *
 * `appearance` was not a member of this enum while Sources passed its build type straight through,
 * so `resolve()` fell to its PLUGIN default and every appearance auto-update installed itself as a
 * plugin — into the plugins root, under the plugin validator, with no error anywhere.
 */
describe('ExtensionScope', () => {
  it('names appearance, so nothing has to fall back to plugin for it', () => {
    expect(ExtensionScope.find('appearance')).toBe(ExtensionScope.APPEARANCE);
  });

  it('returns null for a scope it does not know, instead of a plausible one', () => {
    expect(ExtensionScope.find('widget')).toBeNull();
    expect(ExtensionScope.find('')).toBeNull();
  });
});

describe('PluginExtensionArchiveInstaller — routing a built package', () => {
  const build = () => {
    const plugins = vi.fn(async () => 'plugin');
    const themes = vi.fn(async () => 'theme');
    const appearances = vi.fn(async () => 'appearance');
    const installer = new PluginExtensionArchiveInstaller(vi.fn(async () => 'archive'), plugins);
    installer.setThemeDirectoryInstaller(themes);
    installer.setAppearanceDirectoryInstaller(appearances);
    return { installer, plugins, themes, appearances };
  };

  it('sends an appearance to the appearance installer, not the plugin one', async () => {
    const { installer, plugins, appearances } = build();

    await installer.installExtensionDirectory('/pkg', ExtensionScope.APPEARANCE);

    expect(appearances).toHaveBeenCalledWith('/pkg');
    expect(plugins).not.toHaveBeenCalled();
  });

  it('sends a theme to the theme installer', async () => {
    const { installer, themes } = build();

    await installer.installExtensionDirectory('/pkg', ExtensionScope.THEME, { activate: false });

    expect(themes).toHaveBeenCalledWith('/pkg', { activate: false });
  });

  it('refuses a scope it cannot name rather than installing it as a plugin', async () => {
    const { installer, plugins } = build();

    await expect(installer.installExtensionDirectory('/pkg', 'widget' as never))
      .rejects.toThrow(/Unknown extension scope/);
    expect(plugins).not.toHaveBeenCalled();
  });

  it('refuses core as a directory: it replaces the project root and keeps its archive', async () => {
    const { installer } = build();

    await expect(installer.installExtensionDirectory('/pkg', ExtensionScope.CORE))
      .rejects.toThrow(/installed from an archive/);
  });

  it('refuses an appearance ARCHIVE, so it cannot silently land in the plugins root', async () => {
    const { installer } = build();

    await expect(installer.installExtensionArchive('/pkg.zip', ExtensionScope.APPEARANCE))
      .rejects.toThrow(/package directory/);
  });
});
