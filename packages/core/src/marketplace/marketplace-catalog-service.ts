import { Logger } from '@fromcode119/sdk';
import { PluginManifest } from '@fromcode119/sdk';
import { DiscoveryService } from '../plugin/services/discovery-service';
import { MarketplaceClient, MarketplacePlugin } from '@fromcode119/marketplace-client';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';

export class MarketplaceCatalogService {
  private logger = new Logger({ namespace: 'marketplace' });
  private client: MarketplaceClient | null = null;
  private manifestCache = new Map<string, PluginManifest>();
  private marketplaceUrl: string | null = null;

  constructor(private discovery: DiscoveryService) {
    const raw = String(process.env.MARKETPLACE_URL || '').trim();
    const normalized = raw.toLowerCase();
    const disabled = normalized === 'off' || normalized === 'false' || normalized === 'disabled';

    if (disabled) {
      this.logger.info('Marketplace disabled via MARKETPLACE_URL.');
      return;
    }

    this.marketplaceUrl = !raw || normalized === 'undefined' || normalized === 'null'
      ? 'https://marketplace.fromcode.com/marketplace.json'
      : raw;
    this.client = new MarketplaceClient(this.marketplaceUrl);
  }

  /**
   * Fetch the full plugin catalog from the marketplace
   */
  public async fetchCatalog(): Promise<MarketplacePlugin[]> {
    try {
      if (!this.client || !this.marketplaceUrl) {
        return [];
      }
      this.logger.debug(`Fetching marketplace catalog from: ${this.marketplaceUrl}`);
      const data = await this.client.fetch();
      this.logger.info(`Successfully fetched ${data.plugins?.length || 0} plugins from marketplace.`);
      return data.plugins || [];
    } catch (err: any) {
      this.logger.error(`Failed to fetch marketplace catalog: ${err.message}`);
      return [];
    }
  }

  /**
   * Search for plugins in the catalog
   */
  public async searchPlugins(query: string): Promise<MarketplacePlugin[]> {
    const catalog = await this.fetchCatalog();
    const q = query.toLowerCase();
    return catalog.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.slug.toLowerCase().includes(q) || 
      p.description?.toLowerCase().includes(q)
    );
  }

  /**
   * Get detailed information for a single plugin
   */
  public async getPluginInfo(slug: string): Promise<MarketplacePlugin | undefined> {
    const catalog = await this.fetchCatalog();
    return catalog.find(p => p.slug === slug);
  }

  /**
   * Download and install a plugin from the marketplace, including its dependencies
   */
  public async downloadAndInstall(slug: string, visited: Set<string> = new Set()): Promise<PluginManifest> {
    if (!this.client) {
      throw new Error('Marketplace is disabled.');
    }

    if (visited.has(slug)) {
      this.logger.debug(`Skipping already processed dependency: ${slug}`);
      const cached = this.manifestCache.get(slug);
      if (cached) return cached;
      
      // If visited but not in cache, it might be a circular dependency or already installed
      // Attempt to return a basic manifest if we can't find anything better
      return { slug, version: 'current' } as any; 
    }
    visited.add(slug);

    const plugin = await this.getPluginInfo(slug);
    if (!plugin) {
      throw new Error(`Plugin "${slug}" not found in marketplace catalog.`);
    }

    // 1. Resolve and install dependencies first
    if (plugin.dependencies && Object.keys(plugin.dependencies).length > 0) {
      this.logger.info(`Installing dependencies for ${slug}: ${Object.keys(plugin.dependencies).join(', ')}`);
      for (const depSlug of Object.keys(plugin.dependencies)) {
        try {
          await this.downloadAndInstall(depSlug, visited);
        } catch (err: any) {
          this.logger.error(`Dependency "${depSlug}" failed for "${slug}": ${err.message}`);
          throw new Error(`Failed to install dependency "${depSlug}" for plugin "${slug}": ${err.message}`);
        }
      }
    }

    this.logger.info(`Downloading and installing plugin: ${slug} v${plugin.version}`);

    // Resolve absolute download URL
    const downloadUrl = this.client.resolveDownloadUrl(plugin.downloadUrl);

    const tempDir = path.join(process.cwd(), '.tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempZipPath = path.join(tempDir, `${slug}-${Date.now()}.zip`);

    try {
      this.logger.debug(`Downloading from ${downloadUrl}...`);
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download plugin: ${response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }

      const fileStream = fs.createWriteStream(tempZipPath);
      // @ts-ignore - native fetch body is not exactly same as node streams but pipeline handles it in Node 18+
      await pipeline(response.body, fileStream);

      const manifest = await this.discovery.installFromZip(tempZipPath);
      this.manifestCache.set(slug, manifest);
      this.logger.info(`Successfully installed plugin: ${slug} (v${manifest.version})`);
      return manifest;
    } catch (error: any) {
      this.logger.error(`Installation failed for ${slug}: ${error.message}`);
      throw error;
    } finally {
      if (fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
      }
    }
  }
}
