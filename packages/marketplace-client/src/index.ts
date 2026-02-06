import path from 'path';
import fs from 'fs-extra';
import archiver from 'archiver';
import { MarketplacePlugin, MarketplaceData } from '@fromcode/sdk';

export { MarketplacePlugin, MarketplaceData };

export class MarketplaceClient {
  private marketplaceUrl: string;

  constructor(url?: string) {
    this.marketplaceUrl = url || process.env.MARKETPLACE_URL || 'https://marketplace.fromcode.com/marketplace.json';
  }

  /**
   * Fetch the full marketplace data
   */
  public async fetch(): Promise<MarketplaceData> {
    try {
      if (this.marketplaceUrl.startsWith('http')) {
        const response = await fetch(this.marketplaceUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch marketplace: ${response.statusText}`);
        }
        return await response.json() as MarketplaceData;
      } else {
        const localPath = path.resolve(this.marketplaceUrl);
        if (!fs.existsSync(localPath)) {
          throw new Error(`Local marketplace file not found: ${localPath}`);
        }
        return await fs.readJson(localPath) as MarketplaceData;
      }
    } catch (error: any) {
      console.error(`[MarketplaceClient] Failed to fetch marketplace: ${error.message}`);
      return { plugins: [], themes: [] };
    }
  }

  /**
   * Pack a plugin into a ZIP file
   */
  public async pack(pluginPath: string, outPath: string): Promise<string> {
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
      
      // Add all files except some common ignores
      archive.glob('**/*', {
        cwd: pluginPath,
        ignore: ['node_modules/**', '.git/**', 'dist/**', '*.zip', '.DS_Store']
      });

      archive.finalize();
    });
  }

  /**
   * Publish a plugin to the marketplace
   */
  public async publish(zipPath: string, token?: string): Promise<any> {
    if (!fs.existsSync(zipPath)) {
      throw new Error(`ZIP file not found: ${zipPath}`);
    }

    const marketplaceBase = this.marketplaceUrl.substring(0, this.marketplaceUrl.lastIndexOf('/'));
    const publishUrl = `${marketplaceBase}/api/plugins/publish`;

    console.log(`[MarketplaceClient] Uploading ${path.basename(zipPath)} to ${publishUrl}...`);

    // In a real implementation, we would use FormData to upload the file
    // For now, we simulate the upload
    
    /*
    const formData = new FormData();
    formData.append('file', fs.createReadStream(zipPath));
    const response = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    return response.json();
    */

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
}
