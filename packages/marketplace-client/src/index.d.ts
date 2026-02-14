import { MarketplacePlugin, MarketplaceData } from '@fromcode/sdk';
export { MarketplacePlugin, MarketplaceData };
export declare class MarketplaceClient {
    private marketplaceUrl;
    constructor(url?: string);
    /**
     * Fetch the full marketplace data
     */
    fetch(): Promise<MarketplaceData>;
    /**
     * Pack a plugin into a ZIP file
     */
    pack(pluginPath: string, outPath: string): Promise<string>;
    /**
     * Publish a plugin to the marketplace
     */
    publish(zipPath: string, token?: string): Promise<any>;
    /**
     * Resolve a download URL relative to the marketplace
     */
    resolveDownloadUrl(url: string): string;
}
