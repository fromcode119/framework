/**
 * PluginExtensionArchiveInstaller
 *
 * Routes an uploaded extension archive to the right installer by type
 * (plugin / theme / core). Theme and core installers are injected at runtime by
 * the host. Extracted from PluginManager to keep that class under the size limit;
 * the manager keeps its public setter / installExtensionArchive entry points and
 * delegates here.
 */
export class PluginExtensionArchiveInstaller {
  private themeArchiveInstaller: ((filePath: string, options?: { activate?: boolean }) => Promise<any>) | null = null;
  private coreArchiveInstaller: ((filePath: string) => Promise<any>) | null = null;

  constructor(
    private installUploadedPluginArchive: (filePath: string, options: { enable?: boolean }) => Promise<any>,
  ) {}

  setThemeArchiveInstaller(installer: (filePath: string, options?: { activate?: boolean }) => Promise<any>): void {
    this.themeArchiveInstaller = installer;
  }

  setCoreArchiveInstaller(installer: (filePath: string) => Promise<any>): void {
    this.coreArchiveInstaller = installer;
  }

  async installExtensionArchive(
    filePath: string,
    type: 'plugin' | 'theme' | 'core',
    options: { enable?: boolean; activate?: boolean } = {},
  ): Promise<any> {
    if (type === 'core') {
      if (!this.coreArchiveInstaller) {
        throw new Error('Core archive installer is not configured.');
      }

      return this.coreArchiveInstaller(filePath);
    }

    if (type === 'theme') {
      if (!this.themeArchiveInstaller) {
        throw new Error('Theme archive installer is not configured.');
      }

      return this.themeArchiveInstaller(filePath, { activate: options.activate });
    }

    return this.installUploadedPluginArchive(filePath, { enable: options.enable });
  }
}
