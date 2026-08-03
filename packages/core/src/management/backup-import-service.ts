import { BackupStorageKind } from '@core/management/enums/backup-storage-kind.enum';
import { BackupArchiveExtension } from '@core/management/enums/backup-archive-extension.enum';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { BackupOperationError } from '@core/management/backup-operation-error';
import { BackupService } from '@core/management/backup-service';

export class BackupImportService {
  private static readonly DEFAULT_FILENAME = 'imported-backup.tar.gz';
  private static readonly DEFAULT_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;
  private static readonly SESSION_ROOT = path.join(os.tmpdir(), 'fromcode-backup-import-sessions');
  private static readonly SESSION_TTL_MS = 24 * 60 * 60 * 1000;

  static importArchive(tempPath: string, originalFilename: string): string {
    if (!tempPath || !fs.existsSync(tempPath) || !fs.statSync(tempPath).isFile()) {
      throw new BackupOperationError(400, 'Uploaded backup archive is missing.');
    }

    const sanitizedFilename = this.sanitizeFilename(originalFilename);
    const extension = this.resolveSupportedExtension(sanitizedFilename);
    if (!extension) {
      throw new BackupOperationError(400, 'Unsupported backup archive format. Upload a .tar.gz, .sql, or .db backup.');
    }

    const targetDirectory = BackupService.getBackupsDirectory(this.resolveTargetSubdirectory(extension).value);
    fs.mkdirSync(targetDirectory, { recursive: true });

    const targetPath = this.resolveUniqueDestinationPath(targetDirectory, sanitizedFilename, extension);
    try {
      fs.copyFileSync(tempPath, targetPath);
    } finally {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }

    return targetPath;
  }

  static startChunkedImport(originalFilename: string, totalSizeBytes: number, totalChunks: number): {
    uploadId: string;
    chunkSizeBytes: number;
    totalChunks: number;
    originalFilename: string;
  } {
    const sanitizedFilename = this.sanitizeFilename(originalFilename);
    const extension = this.resolveSupportedExtension(sanitizedFilename);
    if (!extension) {
      throw new BackupOperationError(400, 'Unsupported backup archive format. Upload a .tar.gz, .sql, or .db backup.');
    }
    if (!Number.isFinite(totalSizeBytes) || totalSizeBytes <= 0) {
      throw new BackupOperationError(400, 'Backup size must be greater than zero.');
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

  static completeChunkedImport(uploadId: string): string {
    const metadata = this.readSessionMetadata(uploadId);
    const receivedChunks = this.countReceivedChunks(uploadId);
    if (receivedChunks !== metadata.totalChunks) {
      throw new BackupOperationError(409, `Upload is incomplete. Received ${receivedChunks} of ${metadata.totalChunks} chunks.`);
    }

    const extension = this.resolveSupportedExtension(metadata.originalFilename);
    if (!extension) {
      throw new BackupOperationError(400, 'Unsupported backup archive format. Upload a .tar.gz, .sql, or .db backup.');
    }

    const assembledPath = path.join(this.resolveSessionDirectory(uploadId), `assembled${extension}`);
    try {
      if (fs.existsSync(assembledPath)) {
        fs.unlinkSync(assembledPath);
      }
      for (let chunkIndex = 0; chunkIndex < metadata.totalChunks; chunkIndex += 1) {
        fs.appendFileSync(assembledPath, fs.readFileSync(this.resolveChunkPath(uploadId, chunkIndex)));
      }
      return this.importArchive(assembledPath, metadata.originalFilename);
    } finally {
      this.removeSession(uploadId);
    }
  }

  private static sanitizeFilename(value: string): string {
    const rawFilename = path.basename(String(value || '').trim()) || BackupImportService.DEFAULT_FILENAME;
    return rawFilename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  }

  private static resolveSupportedExtension(filename: string): BackupArchiveExtension | null {
    const lowerCaseFilename = filename.toLowerCase();
    if (lowerCaseFilename.endsWith(BackupArchiveExtension.TAR_GZ.value)) return BackupArchiveExtension.TAR_GZ;
    if (lowerCaseFilename.endsWith(BackupArchiveExtension.SQL.value)) return BackupArchiveExtension.SQL;
    if (lowerCaseFilename.endsWith(BackupArchiveExtension.DB.value)) return BackupArchiveExtension.DB;
    return null;
  }

  private static resolveTargetSubdirectory(extension: BackupArchiveExtension): BackupStorageKind {
    return extension === BackupArchiveExtension.SQL || extension === BackupArchiveExtension.DB ? BackupStorageKind.DATABASE : BackupStorageKind.SYSTEM;
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
    createdAt: string;
  } {
    const metadataPath = this.resolveMetadataPath(String(uploadId || '').trim());
    if (!fs.existsSync(metadataPath)) {
      throw new BackupOperationError(404, 'Backup upload session was not found or has expired.');
    }

    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return {
        uploadId: String(metadata?.uploadId || '').trim(),
        originalFilename: String(metadata?.originalFilename || '').trim(),
        totalSizeBytes: Number(metadata?.totalSizeBytes || 0),
        totalChunks: Number(metadata?.totalChunks || 0),
        createdAt: String(metadata?.createdAt || '').trim(),
      };
    } catch {
      throw new BackupOperationError(500, 'Backup upload session metadata is invalid.');
    }
  }

  private static countReceivedChunks(uploadId: string): number {
    const chunkDirectory = this.resolveChunkDirectory(uploadId);
    if (!fs.existsSync(chunkDirectory)) {
      return 0;
    }
    return fs.readdirSync(chunkDirectory).filter((entry) => entry.endsWith('.part')).length;
  }

  private static removeSession(uploadId: string): void {
    const sessionDirectory = this.resolveSessionDirectory(uploadId);
    if (fs.existsSync(sessionDirectory)) {
      fs.rmSync(sessionDirectory, { recursive: true, force: true });
    }
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

  private static resolveUniqueDestinationPath(directoryPath: string, filename: string, extension: BackupArchiveExtension): string {
    const basename = filename.slice(0, filename.length - extension.value.length) || 'imported-backup';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let candidatePath = path.join(directoryPath, `${basename}${extension}`);
    if (!fs.existsSync(candidatePath)) {
      return candidatePath;
    }

    candidatePath = path.join(directoryPath, `${basename}-${timestamp}${extension}`);
    let counter = 1;
    while (fs.existsSync(candidatePath)) {
      candidatePath = path.join(directoryPath, `${basename}-${timestamp}-${counter}${extension}`);
      counter += 1;
    }

    return candidatePath;
  }
}