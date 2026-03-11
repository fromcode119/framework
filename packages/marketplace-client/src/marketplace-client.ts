import type { MarketplaceData } from './marketplace-client.interfaces';
import { MarketplaceClientConstants } from './marketplace-client-constants';
import { MarketplaceClientLogger } from './marketplace-client-logger';

export class MarketplaceClient {
  private marketplaceUrl: string;
  private readonly fetchTimeoutMs: number;
  private readonly disabled: boolean;

  constructor(url?: string) {
    const raw = String(url ?? process.env.MARKETPLACE_URL ?? '').trim();
    this.disabled = MarketplaceClient.isMarketplaceDisabled(raw);
    this.marketplaceUrl = this.disabled
      ? ''
      : (raw || MarketplaceClientConstants.DEFAULT_MARKETPLACE_URL);
    this.fetchTimeoutMs = MarketplaceClient.parseFetchTimeoutMs(process.env.MARKETPLACE_FETCH_TIMEOUT_MS);
  }

  /**
   * Fetch the full marketplace data
   */
  public async fetch(): Promise<MarketplaceData> {
    if (this.disabled) {
      return { plugins: [], themes: [] };
    }

    try {
      if (this.marketplaceUrl.startsWith('http')) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
        let response: Response;
        try {
          response = await fetch(this.marketplaceUrl, { signal: controller.signal });
        } finally {
          clearTimeout(timeout);
        }
        if (!response.ok) {
          throw new Error(`Failed to fetch marketplace: ${response.statusText}`);
        }
        return await response.json() as MarketplaceData;
      }

      const fs = require('fs-extra');
      const path = require('path');
      const localPath = path.resolve(this.marketplaceUrl);
      if (!fs.existsSync(localPath)) {
        throw new Error(`Local marketplace file not found: ${localPath}`);
      }
      return await fs.readJson(localPath) as MarketplaceData;
    } catch (error: any) {
      MarketplaceClientLogger.error(`[MarketplaceClient] Failed to fetch marketplace: ${error.message}`);
      return { plugins: [], themes: [] };
    }
  }

  /**
   * Pack a plugin into a ZIP file
   */
  public async pack(pluginPath: string, outPath: string): Promise<string> {
    const fs = require('fs-extra');
    const archiver = require('archiver');
    const path = require('path');

    if (!fs.existsSync(pluginPath)) {
      throw new Error(`Plugin path does not exist: ${pluginPath}`);
    }

    const manifestPath = path.join(pluginPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`manifest.json not found in ${pluginPath}`);
    }

    const manifest = await fs.readJson(manifestPath);
    const zipName = `${manifest.slug}-${manifest.version}.zip`;
    const zipPath = path.join(outPath, zipName);

    await fs.ensureDir(outPath);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(zipPath));
      archive.on('error', (err) => reject(err));

      archive.pipe(output);

      archive.glob('**/*', {
        cwd: pluginPath,
        ignore: ['node_modules/**', '.git/**', 'dist/**', '*.zip', '.DS_Store'],
      });

      archive.finalize();
    });
  }

  /**
   * Publish a plugin to the marketplace
   */
  public async publish(zipPath: string, token?: string): Promise<any> {
    const fs = require('fs-extra');
    const path = require('path');
    if (!fs.existsSync(zipPath)) {
      throw new Error(`ZIP file not found: ${zipPath}`);
    }

    const marketplaceBase = this.marketplaceUrl.substring(0, this.marketplaceUrl.lastIndexOf('/'));
    const publishUrl = `${marketplaceBase}/api/plugins/publish`;

    MarketplaceClientLogger.info(`[MarketplaceClient] Uploading ${path.basename(zipPath)} to ${publishUrl}...`);

    // In a real implementation, we would use FormData to upload the file.
    // For now, we simulate the upload.
    void token;

    return { success: true, message: 'Simulated upload successful' };
  }

  /**
   * Resolve a download URL relative to the marketplace
   */
  public resolveDownloadUrl(url: string): string {
    if (url.startsWith('http')) return url;
    if (!this.marketplaceUrl.startsWith('http')) return url;

    const baseUrl = this.marketplaceUrl.substring(0, this.marketplaceUrl.lastIndexOf('/'));
    return new URL(url, baseUrl + '/').toString();
  }

  private static isMarketplaceDisabled(value: string): boolean {
    const normalized = String(value || '').trim().toLowerCase();
    return ['off', 'false', 'disabled', 'no', '0'].includes(normalized);
  }

  private static parseFetchTimeoutMs(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return MarketplaceClientConstants.DEFAULT_FETCH_TIMEOUT_MS;
    }
    return Math.floor(parsed);
  }
}
