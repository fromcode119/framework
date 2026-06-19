import { ThemeManifest } from '../types';
import { Logger } from '../logging';
import { MarketplaceClient } from '@fromcode119/marketplace-client';

/**
 * ThemeUpdateService
 *
 * Marketplace catalog fetch and per-theme update-availability checks. Extracted
 * from ThemeManager to keep that class under the size limit; the manager keeps
 * its public getMarketplaceThemes() / checkForUpdates() entry points and delegates.
 */
export class ThemeUpdateService {
  constructor(
    private themes: Map<string, ThemeManifest>,
    private client: MarketplaceClient,
    private logger: Logger,
  ) {}

  async getMarketplaceThemes() {
    try {
      this.logger.debug(`Fetching themes from marketplace...`);
      const data = await this.client.fetch();
      return data.themes || [];
    } catch (err: any) {
      this.logger.error(`Failed to fetch themes from marketplace: ${err.message}`);
      return [];
    }
  }

  async checkForUpdates(slug: string): Promise<{ available: boolean; currentVersion: string; latestVersion?: string; updateUrl?: string }> {
    const theme = this.themes.get(slug);
    if (!theme) throw new Error(`Theme "${slug}" not found.`);
    if ((theme as any).updateUrl) {
      try {
        const response = await fetch((theme as any).updateUrl.replace('.zip', '.json'));
        if (response.ok) {
          const data = await response.json();
          if (data.version && data.version !== theme.version) {
            return { available: true, currentVersion: theme.version, latestVersion: data.version, updateUrl: data.downloadUrl || (theme as any).updateUrl };
          }
        }
      } catch (e) {
        this.logger.warn(`Failed to check external update URL for ${slug}: ${(e as Error).message}`);
      }
    }
    try {
      const marketplaceThemes = await this.getMarketplaceThemes();
      const pkg = marketplaceThemes.find((t: any) => t.slug === slug);
      if (pkg && pkg.version !== theme.version) {
        return { available: true, currentVersion: theme.version, latestVersion: pkg.version, updateUrl: pkg.downloadUrl };
      }
    } catch (e) {}
    return { available: false, currentVersion: theme.version };
  }
}
