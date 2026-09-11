import type { IThemeManifest } from '@core/theme/interfaces/theme-manifest.interface';
import { Logger } from '@core/logging';
import { MarketplaceClient } from '@fromcode119/marketplace-client';
import { CatalogEntry } from '@core/marketplace/contributions/catalog-entry';
import { CoreServices } from '@core/services/core-services';

/**
 * ThemeUpdateService
 *
 * Marketplace catalog fetch and per-theme update-availability checks. Extracted
 * from ThemeManager to keep that class under the size limit; the manager keeps
 * its public getMarketplaceThemes() / checkForUpdates() entry points and delegates.
 */
export class ThemeUpdateService {
  constructor(
    private themes: Map<string, IThemeManifest>,
    private client: MarketplaceClient,
    private logger: Logger,
  ) {}

  /**
   * The themes on offer: the remote marketplace PLUS anything this installation built itself.
   *
   * The second half was missing. Sources builds a theme from its repository, records it, and offers
   * it to the catalogue — and the plugins screen has always merged those contributions. This one
   * asked the remote marketplace only, so a theme you built on your own server appeared nowhere:
   * Sources said "Success", Themes → Marketplace said "Marketplace empty", and there was no way to
   * install the thing that had just been built. An installation with no marketplace configured could
   * never install its own theme at all.
   *
   * A remote failure no longer empties the list either: what this installation built is known
   * locally and does not depend on reaching anything.
   */
  async getMarketplaceThemes() {
    const contributed = await ThemeUpdateService.contributedThemes();

    try {
      this.logger.debug(`Fetching themes from marketplace...`);
      const data = await this.client.fetch();
      return [...(data.themes || []), ...contributed];
    } catch (err: any) {
      this.logger.error(`Failed to fetch themes from marketplace: ${err.message}`);
      return contributed;
    }
  }

  /**
   * Versions offered by something on THIS installation, narrowed to themes.
   *
   * Contributors describe what they built with `kind`; the same registry carries plugins, and handing
   * a plugin to the themes screen would offer an install that cannot work.
   */
  private static async contributedThemes(): Promise<Array<Record<string, unknown>>> {
    const themes: Array<Record<string, unknown>> = [];
    for (const contributor of CoreServices.getInstance().catalogContributions.list()) {
      try {
        for (const row of (await contributor.list()) || []) {
          const entry = CatalogEntry.from(row as Record<string, unknown>);
          if (entry && entry.kind === 'theme') themes.push(entry.toCatalogPlugin());
        }
      } catch {
        // One broken contributor must not hide every other offer, exactly as on the plugins side.
      }
    }
    return themes;
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
      // Coerced, not asserted: an offer may come from a remote catalogue or from a contributor on
      // this installation, and neither is this code's to trust the shape of.
      const offeredVersion = String((pkg as Record<string, unknown>)?.version ?? '').trim();
      if (pkg && offeredVersion && offeredVersion !== theme.version) {
        return {
          available: true,
          currentVersion: theme.version,
          latestVersion: offeredVersion,
          updateUrl: String((pkg as Record<string, unknown>)?.downloadUrl ?? '').trim() || undefined,
        };
      }
    } catch (e) {}
    return { available: false, currentVersion: theme.version };
  }
}
