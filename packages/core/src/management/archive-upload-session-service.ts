import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BackupOperationError } from './backup-operation-error';

export class ArchiveUploadSessionService {
  private static readonly DEFAULT_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;
  private static readonly SESSION_ROOT = path.join(os.tmpdir(), 'fromcode-archive-upload-sessions');
  private static readonly SESSION_TTL_MS = 24 * 60 * 60 * 1000;

  static startSession(originalFilename: string, totalSizeBytes: number, totalChunks: number, allowedExtensions: string[]): {
    uploadId: string;
    chunkSizeBytes: number;
    totalChunks: number;
    originalFilename: string;
  } {
    const sanitizedFilename = this.sanitizeFilename(originalFilename);
    const normalizedAllowedExtensions = this.normalizeAllowedExtensions(allowedExtensions);
    if (!this.isAllowedExtension(sanitizedFilename, normalizedAllowedExtensions)) {
      throw new BackupOperationError(400, `Unsupported archive format. Upload one of: ${normalizedAllowedExtensions.join(', ')}.`);
    }
    if (!Number.isFinite(totalSizeBytes) || totalSizeBytes <= 0) {
      throw new BackupOperationError(400, 'Archive size must be greater than zero.');
    }
    if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
      throw new BackupOperationError(400, 'Chunk count must be a positive integer.');
    }

    this.pruneExpiredSessions();
    const uploadId = crypto.randomUUID();
    fs.mkdirSync(this.resolveChunkDirectory(uploadId), { recursive: true });
    fs.writeFileSync(
      this.resolveMetadataPath(uploadId),
      JSON.stringify({
        uploadId,
        originalFilename: sanitizedFilename,
        totalSizeBytes,
        totalChunks,
        allowedExtensions: normalizedAllowedExtensions,
        createdAt: new Date().toISOString(),
      }),
      'utf8',
    );

    return {
      uploadId,
      chunkSizeBytes: this.DEFAULT_CHUNK_SIZE_BYTES,
      totalChunks,
      originalFilename: sanitizedFilename,
    };
  }

  static appendChunk(uploadId: string, tempPath: string, chunkIndex: number, totalChunks: number): {
    uploadId: string;
    receivedChunks: number;
    totalChunks: number;
    complete: boolean;
  } {
    const metadata = this.readSessionMetadata(uploadId);
    if (metadata.totalChunks !== totalChunks) {
      throw new BackupOperationError(409, 'Upload session does not match the provided chunk count.');
    }
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
      throw new BackupOperationError(400, 'Chunk index is out of range.');
    }
    if (!tempPath || !fs.existsSync(tempPath) || !fs.statSync(tempPath).isFile()) {
      throw new BackupOperationError(400, 'Uploaded chunk is missing.');
    }

    const chunkPath = this.resolveChunkPath(uploadId, chunkIndex);
    try {
      fs.copyFileSync(tempPath, chunkPath);
    } finally {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }

    const receivedChunks = this.countReceivedChunks(uploadId);
    return {
      uploadId,
      receivedChunks,
      totalChunks: metadata.totalChunks,
      complete: receivedChunks === metadata.totalChunks,
    };
  }

  static resolveUploadedArchive(uploadId: string): { filePath: string; originalFilename: string } {
    const metadata = this.readSessionMetadata(uploadId);
    const receivedChunks = this.countReceivedChunks(uploadId);
    if (receivedChunks !== metadata.totalChunks) {
      throw new BackupOperationError(409, `Upload is incomplete. Received ${receivedChunks} of ${metadata.totalChunks} chunks.`);
    }

    return {
      filePath: this.ensureAssembledFile(uploadId, metadata.originalFilename),
      originalFilename: metadata.originalFilename,
    };
  }

  static discardSession(uploadId: string): void {
    const sessionDirectory = this.resolveSessionDirectory(uploadId);
    if (fs.existsSync(sessionDirectory)) {
      fs.rmSync(sessionDirectory, { recursive: true, force: true });
    }
  }

  private static ensureAssembledFile(uploadId: string, originalFilename: string): string {
    const assembledPath = path.join(this.resolveSessionDirectory(uploadId), `assembled${path.extname(originalFilename) || '.bin'}`);
    if (fs.existsSync(assembledPath)) {
      return assembledPath;
    }

    const metadata = this.readSessionMetadata(uploadId);
    for (let chunkIndex = 0; chunkIndex < metadata.totalChunks; chunkIndex += 1) {
      fs.appendFileSync(assembledPath, fs.readFileSync(this.resolveChunkPath(uploadId, chunkIndex)));
    }
    return assembledPath;
  }

  private static sanitizeFilename(value: string): string {
    const rawFilename = path.basename(String(value || '').trim()) || 'uploaded-archive.bin';
    return rawFilename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  }

  private static normalizeAllowedExtensions(allowedExtensions: string[]): string[] {
    const normalized = Array.from(new Set((allowedExtensions || []).map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean)));
    if (!normalized.length) {
      throw new BackupOperationError(500, 'Archive upload session has no allowed extensions configured.');
    }
    return normalized;
  }

  private static isAllowedExtension(filename: string, allowedExtensions: string[]): boolean {
    const lowerCaseFilename = filename.toLowerCase();
    return allowedExtensions.some((extension) => lowerCaseFilename.endsWith(extension));
  }

  private static resolveSessionDirectory(uploadId: string): string {
    return path.join(this.SESSION_ROOT, uploadId);
  }

  private static resolveChunkDirectory(uploadId: string): string {
    return path.join(this.resolveSessionDirectory(uploadId), 'chunks');
  }

  private static resolveMetadataPath(uploadId: string): string {
    return path.join(this.resolveSessionDirectory(uploadId), 'metadata.json');
  }

  private static resolveChunkPath(uploadId: string, chunkIndex: number): string {
    return path.join(this.resolveChunkDirectory(uploadId), `${String(chunkIndex).padStart(6, '0')}.part`);
  }

  private static readSessionMetadata(uploadId: string): {
    uploadId: string;
    originalFilename: string;
    totalSizeBytes: number;
    totalChunks: number;
    allowedExtensions: string[];
    createdAt: string;
  } {
    const metadataPath = this.resolveMetadataPath(String(uploadId || '').trim());
    if (!fs.existsSync(metadataPath)) {
      throw new BackupOperationError(404, 'Archive upload session was not found or has expired.');
    }

    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return {
        uploadId: String(metadata?.uploadId || '').trim(),
        originalFilename: String(metadata?.originalFilename || '').trim(),
        totalSizeBytes: Number(metadata?.totalSizeBytes || 0),
        totalChunks: Number(metadata?.totalChunks || 0),
        allowedExtensions: this.normalizeAllowedExtensions(Array.isArray(metadata?.allowedExtensions) ? metadata.allowedExtensions : []),
        createdAt: String(metadata?.createdAt || '').trim(),
      };
    } catch {
      throw new BackupOperationError(500, 'Archive upload session metadata is invalid.');
    }
  }

  private static countReceivedChunks(uploadId: string): number {
    const chunkDirectory = this.resolveChunkDirectory(uploadId);
    if (!fs.existsSync(chunkDirectory)) {
      return 0;
    }
    return fs.readdirSync(chunkDirectory).filter((entry) => entry.endsWith('.part')).length;
  }

  private static pruneExpiredSessions(): void {
    if (!fs.existsSync(this.SESSION_ROOT)) {
      return;
    }

    for (const entry of fs.readdirSync(this.SESSION_ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const sessionDirectory = path.join(this.SESSION_ROOT, entry.name);
      const metadataPath = path.join(sessionDirectory, 'metadata.json');
      const statPath = fs.existsSync(metadataPath) ? metadataPath : sessionDirectory;
      const ageMs = Date.now() - fs.statSync(statPath).mtimeMs;
      if (ageMs > this.SESSION_TTL_MS) {
        fs.rmSync(sessionDirectory, { recursive: true, force: true });
      }
    }
  }
}