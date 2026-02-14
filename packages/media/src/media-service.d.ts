import { StorageDriver } from './index';
export declare class MediaService {
    private manager;
    constructor(driver: StorageDriver);
    /**
     * Basic upload of a complete file buffer
     */
    upload(file: Buffer, filename: string): Promise<{
        url: string;
        path: string;
        width?: number;
        height?: number;
        size: number;
        mimeType: string;
        provider: string;
    }>;
    /**
     * Placeholder for chunked uploads (Phase 5 requirement)
     * In a real implementation, this would involve tracking uploadId,
     * storing chunks in a temp directory, and assembling them.
     */
    uploadChunk(uploadId: string, chunk: Buffer, index: number, totalChunks: number): Promise<{
        status: string;
        index: number;
    }>;
    /**
     * Delete a file from storage
     */
    delete(filepath: string): Promise<void>;
    /**
     * Get the underlying driver
     */
    getDriver(): StorageDriver;
}
