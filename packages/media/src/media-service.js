"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = void 0;
const index_1 = require("./index");
class MediaService {
    manager;
    constructor(driver) {
        this.manager = new index_1.MediaManager(driver);
    }
    /**
     * Basic upload of a complete file buffer
     */
    async upload(file, filename) {
        return await this.manager.upload(file, filename);
    }
    /**
     * Placeholder for chunked uploads (Phase 5 requirement)
     * In a real implementation, this would involve tracking uploadId,
     * storing chunks in a temp directory, and assembling them.
     */
    async uploadChunk(uploadId, chunk, index, totalChunks) {
        console.log(`Uploading chunk ${index + 1}/${totalChunks} for ${uploadId}`);
        // implementation would go here
        return { status: 'received', index };
    }
    /**
     * Delete a file from storage
     */
    async delete(filepath) {
        return await this.manager.remove(filepath);
    }
    /**
     * Get the underlying driver
     */
    getDriver() {
        return this.manager.driver;
    }
}
exports.MediaService = MediaService;
//# sourceMappingURL=MediaService.js.map