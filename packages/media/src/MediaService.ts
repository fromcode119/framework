import { MediaManager, StorageDriver } from './index';

export class MediaService {
  private manager: MediaManager;

  constructor(driver: StorageDriver) {
    this.manager = new MediaManager(driver);
  }

  /**
   * Basic upload of a complete file buffer
   */
  async upload(file: Buffer, filename: string) {
    return await this.manager.upload(file, filename);
  }

  /**
   * Placeholder for chunked uploads (Phase 5 requirement)
   * In a real implementation, this would involve tracking uploadId, 
   * storing chunks in a temp directory, and assembling them.
   */
  async uploadChunk(uploadId: string, chunk: Buffer, index: number, totalChunks: number) {
    console.log(`Uploading chunk ${index + 1}/${totalChunks} for ${uploadId}`);
    // implementation would go here
    return { status: 'received', index };
  }

  /**
   * Delete a file from storage
   */
  async delete(filepath: string) {
    return await this.manager.remove(filepath);
  }

  /**
   * Get the underlying driver
   */
  getDriver() {
    return this.manager.driver;
  }
}
