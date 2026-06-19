import { Request } from 'express';

/**
 * Validates chunked-upload request payloads (session start, chunk append,
 * staged-upload id) shared by the plugin and theme controllers. Extracted so
 * neither archive-support class duplicates the parsing/validation; behavior is
 * identical to the previous per-controller private methods.
 */
export class ArchiveUploadRequestParser {
  static readUploadSessionRequest(body: unknown): { originalFilename: string; totalSizeBytes: number; totalChunks: number } {
    if (!body || typeof body !== 'object') {
      throw new Error('Upload session payload is required.');
    }
    const originalFilename = String((body as { originalFilename?: unknown }).originalFilename || '').trim();
    const totalSizeBytes = Number((body as { totalSizeBytes?: unknown }).totalSizeBytes || 0);
    const totalChunks = Number((body as { totalChunks?: unknown }).totalChunks || 0);
    if (!originalFilename) {
      throw new Error('originalFilename is required.');
    }
    if (!Number.isFinite(totalSizeBytes) || totalSizeBytes <= 0) {
      throw new Error('totalSizeBytes must be greater than zero.');
    }
    if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
      throw new Error('totalChunks must be a positive integer.');
    }
    return { originalFilename, totalSizeBytes, totalChunks };
  }

  static readChunkUploadRequest(req: Request): { uploadId: string; filePath: string; chunkIndex: number; totalChunks: number } {
    const uploadRequest = req as Request & {
      file?: { path?: unknown };
      body?: { uploadId?: unknown; chunkIndex?: unknown; totalChunks?: unknown };
    };
    const uploadId = String(uploadRequest.body?.uploadId || '').trim();
    const filePath = String(uploadRequest.file?.path || '').trim();
    const chunkIndex = Number(uploadRequest.body?.chunkIndex || -1);
    const totalChunks = Number(uploadRequest.body?.totalChunks || 0);
    if (!uploadId) {
      throw new Error('uploadId is required.');
    }
    if (!filePath) {
      throw new Error('chunk file is required.');
    }
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      throw new Error('chunkIndex must be a non-negative integer.');
    }
    if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
      throw new Error('totalChunks must be a positive integer.');
    }
    return { uploadId, filePath, chunkIndex, totalChunks };
  }

  static readUploadId(body: unknown): string {
    const uploadId = String((body as { uploadId?: unknown } | null | undefined)?.uploadId || '').trim();
    if (!uploadId) {
      throw new Error('uploadId is required.');
    }
    return uploadId;
  }
}
