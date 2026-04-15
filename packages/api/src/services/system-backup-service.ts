import fs from 'fs';
import {
  BackupCatalogService,
  BackupImportService,
  BackupRestoreGuardService,
  BackupService,
  type BackupCatalogItem,
  type RestoreTargetKind,
} from '@fromcode119/core';
import { SystemBackupRepository } from '../repositories/system-backup-repository';
import type {
  CreateSystemBackupRequest,
  RestoreExecuteResponse,
  RestorePreviewResponse,
  SystemBackupCapabilities,
  SystemBackupListResponse,
  SystemBackupMutationResponse,
} from './system-backup-service.types';

export class SystemBackupService {
  private readonly catalog: BackupCatalogService;
  private readonly restoreGuard: BackupRestoreGuardService;

  constructor(private readonly repository: SystemBackupRepository) {
    this.catalog = new BackupCatalogService();
    this.restoreGuard = new BackupRestoreGuardService(this.catalog);
  }

  async listBackups(capabilities: SystemBackupCapabilities): Promise<SystemBackupListResponse> {
    return {
      groups: await this.catalog.listBackupGroups(),
      capabilities,
    };
  }

  async createSystemBackup(actor: Record<string, unknown>, request: CreateSystemBackupRequest = {}): Promise<SystemBackupMutationResponse> {
    const result = await BackupService.createSystemBackupBundle({ sections: request.sections });
    const backup = this.toCatalogItem(this.catalog.resolveByPath(result.backupPath));
    await this.repository.recordOperation({
      action: 'backup.create',
      resource: backup.filename,
      status: 'allowed',
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

  async importBackup(actor: Record<string, unknown>, uploadedFilePath: string, originalFilename: string): Promise<SystemBackupMutationResponse> {
    const backupPath = BackupImportService.importArchive(uploadedFilePath, originalFilename);
    const backup = this.toCatalogItem(this.catalog.resolveByPath(backupPath));
    await this.repository.recordOperation({
      action: 'backup.import',
      resource: backup.filename,
      status: 'allowed',
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
      status: 'allowed',
      metadata: actor,
    });
    return { filePath: backup.absolutePath, filename: backup.filename };
  }

  async deleteBackup(id: string, actor: Record<string, unknown>): Promise<SystemBackupMutationResponse> {
    const backup = await this.catalog.resolveById(id);
    if (backup.rootKind !== 'backups') {
      const error = new Error('Only managed backups beneath the backups directory can be deleted.') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }
    fs.unlinkSync(backup.absolutePath);
    await this.repository.recordOperation({
      action: 'backup.delete',
      resource: backup.filename,
      status: 'allowed',
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

  async previewRestore(id: string, targetKind: RestoreTargetKind, actor: Record<string, unknown>): Promise<RestorePreviewResponse> {
    const preview = await this.restoreGuard.previewRestore({ backupId: id, targetKind });
    await this.repository.recordOperation({
      action: 'backup.restore.preview',
      resource: preview.backup.filename,
      status: 'allowed',
      metadata: { ...actor, targetKind: preview.targetKind },
    });
    return {
      backup: this.toCatalogItem(preview.backup),
      targetKind: preview.targetKind,
      targetLabel: preview.targetLabel,
      warnings: preview.warnings,
      previewToken: preview.previewToken,
      previewExpiresAt: preview.previewExpiresAt,
      requiredConfirmationText: preview.requiredConfirmationText,
      snapshotType: preview.snapshotType,
    };
  }

  async executeRestore(
    id: string,
    targetKind: RestoreTargetKind,
    previewToken: string,
    confirmationText: string,
    actor: Record<string, unknown>,
  ): Promise<RestoreExecuteResponse> {
    const result = await this.restoreGuard.executeRestore({
      backupId: id,
      targetKind,
      previewToken,
      confirmationText,
    });
    await this.repository.recordOperation({
      action: 'backup.restore.execute',
      resource: result.backup.filename,
      status: 'allowed',
      metadata: {
        ...actor,
        targetKind: result.targetKind,
        rollbackSnapshotPath: result.rollbackSnapshotPath,
      },
    });
    return {
      success: true,
      backup: this.toCatalogItem(result.backup),
      targetKind: result.targetKind,
      rollbackSnapshotPath: result.rollbackSnapshotPath,
    };
  }

  private toCatalogItem(backup: BackupCatalogItem & { absolutePath?: string; relativePath?: string }): BackupCatalogItem {
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