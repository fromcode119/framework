import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';

/**
 * PluginExtensionArchiveInstaller
 *
 * Routes an extension package to the right installer by scope (plugin / theme / appearance / core).
 * Theme, appearance and core installers are injected at runtime by the host. Extracted from
 * PluginManager to keep that class under the size limit; the manager keeps its public setter and
 * `installExtensionArchive` / `installExtensionDirectory` entry points and delegates here.
 *
 * Two shapes of package arrive. An ARCHIVE comes from an upload or a remote marketplace and has to
 * be unpacked. A DIRECTORY comes from a build on this installation, which already staged a cleaned,
 * checksum-stamped package — zipping that so it could be unzipped back into the same shape was pure
 * round trip, and the zip was where the packaging silently stopped happening.
 */
export class PluginExtensionArchiveInstaller {
  private themeArchiveInstaller: ((filePath: string, options?: { activate?: boolean }) => Promise<any>) | null = null;
  private coreArchiveInstaller: ((filePath: string) => Promise<any>) | null = null;
  private themeDirectoryInstaller: ((packageDir: string, options?: { activate?: boolean }) => Promise<any>) | null = null;
  private appearanceDirectoryInstaller: ((packageDir: string) => Promise<any>) | null = null;

  constructor(
    private installUploadedPluginArchive: (filePath: string, options: { enable?: boolean }) => Promise<any>,
    private installPluginDirectory: (packageDir: string, options: { enable?: boolean }) => Promise<any>,
  ) {}

  setThemeArchiveInstaller(installer: (filePath: string, options?: { activate?: boolean }) => Promise<any>): void {
    this.themeArchiveInstaller = installer;
  }

  setCoreArchiveInstaller(installer: (filePath: string) => Promise<any>): void {
    this.coreArchiveInstaller = installer;
  }

  setThemeDirectoryInstaller(installer: (packageDir: string, options?: { activate?: boolean }) => Promise<any>): void {
    this.themeDirectoryInstaller = installer;
  }

  setAppearanceDirectoryInstaller(installer: (packageDir: string) => Promise<any>): void {
    this.appearanceDirectoryInstaller = installer;
  }

  async installExtensionArchive(
    filePath: string,
    type: ExtensionScope,
    options: { enable?: boolean; activate?: boolean } = {},
  ): Promise<any> {
    const scope = PluginExtensionArchiveInstaller.scopeOf(type);

    if (scope === ExtensionScope.CORE) {
      if (!this.coreArchiveInstaller) throw new Error('Core archive installer is not configured.');
      return this.coreArchiveInstaller(filePath);
    }

    if (scope === ExtensionScope.THEME) {
      if (!this.themeArchiveInstaller) throw new Error('Theme archive installer is not configured.');
      return this.themeArchiveInstaller(filePath, { activate: options.activate });
    }

    if (scope === ExtensionScope.APPEARANCE) {
      throw new Error('An appearance is installed from a package directory, not an archive.');
    }

    return this.installUploadedPluginArchive(filePath, { enable: options.enable });
  }

  /** Installs a package directory this installation built. */
  async installExtensionDirectory(
    packageDir: string,
    type: ExtensionScope,
    options: { enable?: boolean; activate?: boolean } = {},
  ): Promise<any> {
    const scope = PluginExtensionArchiveInstaller.scopeOf(type);

    if (scope === ExtensionScope.CORE) {
      // Core replaces the live project root. That is a different operation with different risks and
      // it keeps its archive; saying so beats routing it somewhere that would half-work.
      throw new Error('Core is installed from an archive, not a package directory.');
    }

    if (scope === ExtensionScope.THEME) {
      if (!this.themeDirectoryInstaller) throw new Error('Theme directory installer is not configured.');
      return this.themeDirectoryInstaller(packageDir, { activate: options.activate });
    }

    if (scope === ExtensionScope.APPEARANCE) {
      if (!this.appearanceDirectoryInstaller) throw new Error('Appearance directory installer is not configured.');
      return this.appearanceDirectoryInstaller(packageDir);
    }

    return this.installPluginDirectory(packageDir, { enable: options.enable });
  }

  /**
   * The scope a value names, refusing one it does not.
   *
   * `ExtensionScope.resolve` defaults to PLUGIN, and this method decides which ROOT a package is
   * written into: `appearance` was not a member of the enum at all while Sources passed its build
   * type straight through, so every appearance auto-update installed itself as a plugin, silently.
   */
  private static scopeOf(type: ExtensionScope): ExtensionScope {
    const scope = ExtensionScope.find(type);
    if (!scope) {
      throw new Error(`Unknown extension scope "${String(type)}" — nothing was installed.`);
    }
    return scope;
  }
}
