export * from './media-service';
export * from './media-collection';
export interface StorageDriver {
    readonly provider: string;
    save(file: Buffer, filename: string, options?: any): Promise<string>;
    delete(filepath: string): Promise<void>;
    getUrl(filepath: string): string;
}
export type StorageDriverCreator = (config: any) => StorageDriver;
export declare class StorageFactory {
    private static drivers;
    static register(name: string, creator: StorageDriverCreator): void;
    static create(name: string, config: any): StorageDriver;
    private static registerDefaults;
}
export declare class MediaManager {
    driver: StorageDriver;
    constructor(driver: StorageDriver);
    get provider(): string;
    upload(file: Buffer, filename: string): Promise<{
        url: string;
        path: string;
        width?: number;
        height?: number;
        size: number;
        mimeType: string;
        provider: string;
    }>;
    remove(filepath: string): Promise<void>;
}
