import { SnapshotType } from '@fromcode119/core';
import { AuditOutcome } from '@fromcode119/core';
import { BackupCatalogRootKind } from '@fromcode119/core';
import fs from 'fs';
import {
  BackupCatalogService,
  BackupImportService,
  BackupRestoreGuardService,
  BackupService,
  type IBackupCatalogItem,
} from '@fromcode119/core';
import { SystemBackupRepository } from '@api/repositories/system-backup-repository';
import type { IBackupImportChunkResponse } from '@api/services/interfaces/backup-import-chunk-response.interface';
import type { IBackupImportSessionResponse } from '@api/services/interfaces/backup-import-session-response.interface';
import type { ICreateSystemBackupRequest } from '@api/services/interfaces/create-system-backup-request.interface';
import type { IRestoreExecuteResponse } from '@api/services/interfaces/restore-execute-response.interface';
import type { IRestorePreviewResponse } from '@api/services/interfaces/restore-preview-response.interface';
import type { ISystemBackupCapabilities } from '@api/services/interfaces/system-backup-capabilities.interface';
import type { ISystemBackupListResponse } from '@api/services/interfaces/system-backup-list-response.interface';
import type { ISystemBackupMutationResponse } from '@api/services/interfaces/system-backup-mutation-response.interface';

export class SystemBackupService {
  private readonly catalog: BackupCatalogService;
  private readonly restoreGuard: BackupRestoreGuardService;

  constructor(private readonly repository: SystemBackupRepository) {
    this.catalog = new BackupCatalogService();
    this.restoreGuard = new BackupRestoreGuardService(this.catalog);
  }

  async listBackups(capabilities: ISystemBackupCapabilities): Promise<ISystemBackupListResponse> {
    return {
      groups: await this.catalog.listBackupGroups(),
      capabilities,
    };
  }

  async createSystemBackup(actor: Record<string, unknown>, request: ICreateSystemBackupRequest = {}): Promise<ISystemBackupMutationResponse> {
    const result = await BackupService.createSystemBackupBundle({ sections: request.sections });
    const backup = this.toCatalogItem(this.catalog.resolveByPath(result.backupPath));
    await this.repository.recordOperation({
      action: 'backup.create',
      resource: backup.filename,
      status: AuditOutcome.ALLOWED,
      metadata: {
        ...actor,
        requestedSections: result.requestedSections,
        includedSections: result.includedSections,
        warnings: result.warnings,
      },
    });
    return {
      success: true,
      backup,
      selection: {
        requestedSections: result.requestedSections,
        includedSections: result.includedSections,
        warnings: result.warnings,
      },
    };
  }

  async importBackup(actor: Record<string, unknown>, uploadedFilePath: string, originalFilename: string): Promise<ISystemBackupMutationResponse> {
    const backupPath = BackupImportService.importArchive(uploadedFilePath, originalFilename);
    const backup = this.toCatalogItem(this.catalog.resolveByPath(backupPath));
    await this.repository.recordOperation({
      action: 'backup.import',
      resource: backup.filename,
      status: AuditOutcome.ALLOWED,
      metadata: actor,
    });
    return {
      success: true,
      backup,
      selection: {
        requestedSections: [],
        includedSections: [],
        warnings: [],
      },
    };
  }

  async startBackupImportSession(originalFilename: string, totalSizeBytes: number, totalChunks: number): Promise<IBackupImportSessionResponse> {
    const session = BackupImportService.startChunkedImport(originalFilename, totalSizeBytes, totalChunks);
    return {
      success: true,
      uploadId: session.uploadId,
      chunkSizeBytes: session.chunkSizeBytes,
      totalChunks: session.totalChunks,
      originalFilename: session.originalFilename,
    };
  }

  async uploadBackupImportChunk(uploadId: string, uploadedChunkPath: string, chunkIndex: number, totalChunks: number): Promise<IBackupImportChunkResponse> {
    const result = BackupImportService.appendChunk(uploadId, uploadedChunkPath, chunkIndex, totalChunks);
    return {
      success: true,
      uploadId: result.uploadId,
      receivedChunks: result.receivedChunks,
      totalChunks: result.totalChunks,
      complete: result.complete,
    };
  }

  async completeBackupImport(actor: Record<string, unknown>, uploadId: string): Promise<ISystemBackupMutationResponse> {
    const backupPath = BackupImportService.completeChunkedImport(uploadId);
    const backup = this.toCatalogItem(this.catalog.resolveByPath(backupPath));
    await this.repository.recordOperation({
      action: 'backup.import',
      resource: backup.filename,
      status: AuditOutcome.ALLOWED,
      metadata: actor,
    });
    return {
      success: true,
      backup,
      selection: {
        requestedSections: [],
        includedSections: [],
        warnings: [],
      },
    };
  }

  async resolveDownload(id: string, actor: Record<string, unknown>): Promise<{ filePath: string; filename: string }> {
    const backup = await this.catalog.resolveById(id);
    await this.repository.recordOperation({
      action: 'backup.download',
      resource: backup.filename,
      status: AuditOutcome.ALLOWED,
      metadata: actor,
    });
    return { filePath: backup.absolutePath, filename: backup.filename };
  }

  async deleteBackup(id: string, actor: Record<string, unknown>): Promise<ISystemBackupMutationResponse> {
    const backup = await this.catalog.resolveById(id);
    if (backup.rootKind !== BackupCatalogRootKind.BACKUPS) {
      const error = new Error('Only managed backups beneath the backups directory can be deleted.') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }
    fs.unlinkSync(backup.absolutePath);
    await this.repository.recordOperation({
      action: 'backup.delete',
      resource: backup.filename,
      status: AuditOutcome.ALLOWED,
      metadata: actor,
    });
    return {
      success: true,
      backup: this.toCatalogItem(backup),
      selection: {
        requestedSections: [],
        includedSections: [],
        warnings: [],
      },
    };
  }

  async previewRestore(id: string, targetKind: string, actor: Record<string, unknown>): Promise<IRestorePreviewResponse> {
    const preview = await this.restoreGuard.previewRestore({ backupId: id, targetKind });
    await this.repository.recordOperation({
      action: 'backup.restore.preview',
      resource: preview.backup.filename,
      status: AuditOutcome.ALLOWED,
      metadata: { ...actor, targetKind: String(preview.targetKind) },
    });
    return {
      backup: this.toCatalogItem(preview.backup),
      targetKind: String(preview.targetKind),
      targetLabel: preview.targetLabel,
      warnings: preview.warnings,
      previewToken: preview.previewToken,
      previewExpiresAt: preview.previewExpiresAt,
      requiredConfirmationText: preview.requiredConfirmationText,
      snapshotType: SnapshotType.resolve(preview.snapshotType),
    };
  }

  async executeRestore(
    id: string,
    targetKind: string,
    previewToken: string,
    confirmationText: string,
    actor: Record<string, unknown>,
  ): Promise<IRestoreExecuteResponse> {
    const result = await this.restoreGuard.executeRestore({
      backupId: id,
      targetKind,
      previewToken,
      confirmationText,
    });
    await this.repository.recordOperation({
      action: 'backup.restore.execute',
      resource: result.backup.filename,
      status: AuditOutcome.ALLOWED,
      metadata: {
        ...actor,
        targetKind: result.targetKind,
        rollbackSnapshotPath: result.rollbackSnapshotPath,
      },
    });
    return {
      success: true,
      backup: this.toCatalogItem(result.backup),
      targetKind: String(result.targetKind),
      rollbackSnapshotPath: result.rollbackSnapshotPath,
    };
  }

  private toCatalogItem(backup: IBackupCatalogItem & { absolutePath?: string; relativePath?: string }): IBackupCatalogItem {
    return {
      id: backup.id,
      filename: backup.filename,
      displayName: backup.displayName,
      group: backup.group,
      rootKind: backup.rootKind,
      scopeSlug: backup.scopeSlug,
      sizeBytes: backup.sizeBytes,
      modifiedAt: backup.modifiedAt,
    };
  }
}