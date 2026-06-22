import path from 'path';
import fs from 'fs';
import semver from 'semver';
import { Logger } from '../logging';
import { ProjectPaths } from '../config/paths';
import { MarketplaceClient } from '@fromcode119/marketplace-client';
import { PlatformSettingsService } from '../management/platform-settings-service';
import { AppearanceInstallerService } from './appearance-installer-service';
import type { AppearanceManifest } from './appearance-manifest.interfaces';
import type { AppearanceSummary } from './appearance-summary.interfaces';
import type { AppearanceCatalogEntry } from './appearance-catalog-entry.interfaces';

/**
 * Manages admin appearances as a SETTINGS concern (distinct from the plugin/theme marketplace UI):
 * list what's available in the appearances dir, browse the marketplace catalog (with update detection),
 * install from a URL/zip or from the catalog, and remove one. The active appearance is the
 * `admin_appearance` system setting (switched in the UI), not handled here.
 */
export class AppearanceManager {
  private installer?: AppearanceInstallerService;
  private clientPromise?: Promise<MarketplaceClient | null>;

  constructor(
    private readonly logger: Logger,
    private readonly appearancesRoot: string = ProjectPaths.getAppearancesDir(),
  ) {}

  list(): AppearanceSummary[] {
    const items: AppearanceSummary[] = [{ slug: 'default', name: 'Default', version: '', builtIn: true }];
    try {
      if (fs.existsSync(this.appearancesRoot)) {
        for (const child of fs.readdirSync(this.appearancesRoot)) {
          if (child.startsWith('.')) continue;
          const dir = path.join(this.appearancesRoot, child);
          const manifestPath = path.join(dir, 'appearance.json');
          if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory() || !fs.existsSync(manifestPath)) continue;
          try {
            const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            items.push({
              slug: String(m.slug || child),
              name: String(m.name || child),
              version: String(m.version || ''),
              builtIn: false,
              sourceUrl: m.sourceUrl ? String(m.sourceUrl) : undefined,
            });
          } catch {
            /* skip unreadable manifest */
          }
        }
      }
    } catch (e) {
      this.logger.warn(`Failed to list appearances: ${(e as Error).message}`);
    }
    return items;
  }

  /**
   * The marketplace appearance catalog merged with local install state. Each entry says whether it is
   * already installed and whether the catalog offers a newer version. Returns [] when the marketplace
   * is disabled or unreachable — the UI then simply shows no "available to install" / update options.
   */
  async catalog(): Promise<AppearanceCatalogEntry[]> {
    const client = await this.resolveClient();
    if (!client) return [];
    let appearances: Awaited<ReturnType<MarketplaceClient['fetch']>>['appearances'] = [];
    try {
      appearances = (await client.fetch()).appearances || [];
    } catch (e) {
      this.logger.warn(`Failed to fetch appearance catalog: ${(e as Error).message}`);
      return [];
    }
    const installedBySlug = new Map(this.list().map((i) => [i.slug, i]));
    return appearances.map((a) => {
      const installed = installedBySlug.get(a.slug);
      return {
        slug: a.slug,
        name: a.name,
        version: a.version,
        description: a.description,
        author: a.author,
        downloadUrl: a.downloadUrl,
        installed: !!installed,
        installedVersion: installed?.version || '',
        updateAvailable: AppearanceManager.isNewer(a.version, installed?.version),
      };
    });
  }

  /** True when the candidate (catalog) version is a valid semver strictly greater than the current one. */
  private static isNewer(candidate?: string, current?: string): boolean {
    const next = semver.valid(semver.coerce(candidate || ''));
    const now = semver.valid(semver.coerce(current || ''));
    return !!next && !!now && semver.gt(next, now);
  }

  async installFromUrl(url: string): Promise<AppearanceManifest> {
    const manifest = await (await this.getInstaller()).installFromUrl(url);
    // Remember where it came from so the UI can offer a one-click update (re-install).
    this.stampSourceUrl(manifest.slug, url);
    return manifest;
  }

  async installFromZip(filePath: string): Promise<AppearanceManifest> {
    return (await this.getInstaller()).installFromZip(filePath);
  }

  /**
   * Install (or update) an appearance from the marketplace catalog by slug — resolves the catalog's
   * download URL and unpacks it into the appearances dir. This is how the Settings UI installs a
   * marketplace appearance and how the per-appearance "Update" pulls the catalog's latest version.
   */
  async installFromCatalog(slug: string): Promise<AppearanceManifest> {
    const client = await this.resolveClient();
    if (!client) throw new Error('The marketplace is disabled.');
    const entry = (await client.fetch()).appearances?.find((a) => a.slug === slug);
    if (!entry?.downloadUrl) {
      throw new Error(`Appearance "${slug}" was not found in the marketplace catalog.`);
    }
    const manifest = await (await this.getInstaller()).installAppearance({ slug, downloadUrl: entry.downloadUrl });
    this.stampSourceUrl(manifest.slug, client.resolveDownloadUrl(entry.downloadUrl));
    return manifest;
  }

  remove(slug: string): void {
    const normalized = String(slug || '').trim();
    if (!normalized || normalized === 'default') {
      throw new Error('Cannot remove the built-in default appearance.');
    }
    const dir = path.join(this.appearancesRoot, normalized);
    if (!fs.existsSync(dir)) {
      throw new Error(`Appearance "${normalized}" is not installed.`);
    }
    fs.rmSync(dir, { recursive: true, force: true });
    this.logger.info(`Appearance "${normalized}" removed from ${dir}.`);
  }

  /** Persist the install URL into the installed appearance's manifest for later updates. */
  private stampSourceUrl(slug: string, url: string): void {
    try {
      const manifestPath = path.join(this.appearancesRoot, String(slug || '').trim(), 'appearance.json');
      if (!fs.existsSync(manifestPath)) return;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest.sourceUrl = url;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    } catch (e) {
      this.logger.warn(`Failed to stamp appearance source URL: ${(e as Error).message}`);
    }
  }

  private async getInstaller(): Promise<AppearanceInstallerService> {
    if (!this.installer) {
      const client = await this.resolveClient();
      this.installer = new AppearanceInstallerService(this.logger, this.appearancesRoot, client ?? new MarketplaceClient());
    }
    return this.installer;
  }

  /** Build a marketplace client from the configured URL/setting, or null when the marketplace is off. */
  private async resolveClient(): Promise<MarketplaceClient | null> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const raw = await PlatformSettingsService.resolve(process.env.MARKETPLACE_URL, PlatformSettingsService.KEY.MARKETPLACE_URL);
        const normalized = String(raw || '').trim().toLowerCase();
        if (!raw || normalized === 'off' || normalized === 'false' || normalized === 'disabled') {
          this.logger.info('Marketplace disabled — appearance catalog/update checks skipped.');
          return null;
        }
        return new MarketplaceClient(raw);
      })();
    }
    return this.clientPromise;
  }
}
