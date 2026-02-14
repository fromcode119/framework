"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceClient = void 0;
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const archiver_1 = __importDefault(require("archiver"));
class MarketplaceClient {
    marketplaceUrl;
    constructor(url) {
        this.marketplaceUrl = url || process.env.MARKETPLACE_URL || 'https://marketplace.fromcode.com/marketplace.json';
    }
    /**
     * Fetch the full marketplace data
     */
    async fetch() {
        try {
            if (this.marketplaceUrl.startsWith('http')) {
                const response = await fetch(this.marketplaceUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch marketplace: ${response.statusText}`);
                }
                return await response.json();
            }
            else {
                const localPath = path_1.default.resolve(this.marketplaceUrl);
                if (!fs_extra_1.default.existsSync(localPath)) {
                    throw new Error(`Local marketplace file not found: ${localPath}`);
                }
                return await fs_extra_1.default.readJson(localPath);
            }
        }
        catch (error) {
            console.error(`[MarketplaceClient] Failed to fetch marketplace: ${error.message}`);
            return { plugins: [], themes: [] };
        }
    }
    /**
     * Pack a plugin into a ZIP file
     */
    async pack(pluginPath, outPath) {
        if (!fs_extra_1.default.existsSync(pluginPath)) {
            throw new Error(`Plugin path does not exist: ${pluginPath}`);
        }
        const manifestPath = path_1.default.join(pluginPath, 'manifest.json');
        if (!fs_extra_1.default.existsSync(manifestPath)) {
            throw new Error(`manifest.json not found in ${pluginPath}`);
        }
        const manifest = await fs_extra_1.default.readJson(manifestPath);
        const zipName = `${manifest.slug}-${manifest.version}.zip`;
        const zipPath = path_1.default.join(outPath, zipName);
        await fs_extra_1.default.ensureDir(outPath);
        return new Promise((resolve, reject) => {
            const output = fs_extra_1.default.createWriteStream(zipPath);
            const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
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
    async publish(zipPath, token) {
        if (!fs_extra_1.default.existsSync(zipPath)) {
            throw new Error(`ZIP file not found: ${zipPath}`);
        }
        const marketplaceBase = this.marketplaceUrl.substring(0, this.marketplaceUrl.lastIndexOf('/'));
        const publishUrl = `${marketplaceBase}/api/plugins/publish`;
        console.log(`[MarketplaceClient] Uploading ${path_1.default.basename(zipPath)} to ${publishUrl}...`);
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
    resolveDownloadUrl(url) {
        if (url.startsWith('http'))
            return url;
        if (!this.marketplaceUrl.startsWith('http'))
            return url;
        const baseUrl = this.marketplaceUrl.substring(0, this.marketplaceUrl.lastIndexOf('/'));
        return new URL(url, baseUrl + '/').toString();
    }
}
exports.MarketplaceClient = MarketplaceClient;
//# sourceMappingURL=index.js.map