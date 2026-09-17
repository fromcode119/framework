import { Logger } from '@core/logging';
import type { IThemeManifest } from '@core/theme/interfaces/theme-manifest.interface';
import type { MarketplaceClient } from '@fromcode119/marketplace-client';
import type { Seeder } from '@core/database/seeder';
import type { ThemeConfigService } from '@core/theme/theme-config-service';
import type { ThemeInstallerService } from '@core/theme/theme-installer-service';

/**
 * The state every half of ThemeManager works on, declared once.
 *
 * `declare` on purpose: these emit NOTHING. The manager is assembled from several behaviour bases
 * through `extends A, B`, and a mixin copies methods onto one prototype chain — so a field declared
 * and initialised in more than one base would be constructed more than once. The manager owns the
 * real fields and their initialisation; each base says only that they exist and what shape they are.
 *
 * This is what lets the halves be small files without passing thirteen constructor arguments between
 * them, or handing each other `manager: any` and losing every type on the way through.
 */
export abstract class ThemeManagerState {
  protected declare activeTheme: string | null;
  protected declare themes: Map<string, IThemeManifest>;
  protected declare themesRoot: string;
  protected declare logger: Logger;
  protected declare client: MarketplaceClient;
  protected declare seeder: Seeder;
  protected declare installer: ThemeInstallerService;
  protected declare configService: ThemeConfigService;
  protected declare db: any;
  protected declare pluginManager?: any;

  /**
   * Declared here because both halves call them and each is implemented in the other.
   *
   * Visibility MATTERS and is not uniform: `discoverThemes`, `activateTheme` and
   * `getActiveThemeManifest` are public API — `IPluginManagerInterface` requires the last one public,
   * and making it protected broke PluginManager's conformance. The rest are internal.
   */
  abstract discoverThemes(): Promise<void>;
  protected abstract resolveThemeDirectory(slug: string): string;
  protected abstract materializeDefaultPages(): Promise<void>;
  protected abstract requireTenant(action: string): string;
  protected abstract refreshStorefrontRenderer(reason: string): Promise<void>;
  abstract getActiveThemeManifest(): IThemeManifest | null;
  abstract activateTheme(slug: string): Promise<any>;
}
