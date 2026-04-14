import fs from 'fs';
import path from 'path';
import { ProjectPaths } from '../config/paths';
import { BackupService } from './backup-service';
import { BackupCatalogService } from './backup-catalog-service';
import { BackupOperationError } from './backup-operation-error';
import { BackupRestorePreviewSessionService } from './backup-restore-preview-session-service';
import type { BackupCatalogResolvedItem } from './backup-catalog-service.types';
import type {
  RestoreExecutionInput,
  RestoreExecutionResult,
  RestorePreviewInput,
  RestoreTargetResolution,
} from './backup-restore-guard-service.interfaces';
import type { RestoreTargetKind } from './backup-restore-guard-service.types';

export class BackupRestoreGuardService {
  constructor(
    private readonly catalog: BackupCatalogService = new BackupCatalogService(),
    private readonly previewSessions: BackupRestorePreviewSessionService = new BackupRestorePreviewSessionService(),
  ) {}

  async previewRestore(input: RestorePreviewInput): Promise<RestoreTargetResolution> {
    const targetResolution = await this.resolveRestoreTarget(input);
    const previewSession = this.previewSessions.createSession({
      backupId: targetResolution.backup.id,
      targetKind: targetResolution.targetKind,
    });

    return {
      backup: targetResolution.backup,
      targetKind: targetResolution.targetKind,
      targetLabel: targetResolution.targetLabel,
      targetPath: targetResolution.targetPath,
      warnings: targetResolution.warnings,
      previewToken: previewSession.token,
      previewExpiresAt: previewSession.expiresAt,
      requiredConfirmationText: previewSession.requiredConfirmationText,
      snapshotType: targetResolution.snapshotType,
    };
  }

  async executeRestore(input: RestoreExecutionInput): Promise<RestoreExecutionResult> {
    const preview = await this.resolveRestoreTarget(input);
    this.previewSessions.consumeSession({
      previewToken: input.previewToken,
      backupId: preview.backup.id,
      targetKind: preview.targetKind,
      confirmationText: input.confirmationText,
    });

    const rollbackSnapshotPath = await this.createSafetySnapshot(preview.targetKind, preview.targetPath);
    await BackupService.restore(preview.backup.absolutePath, preview.targetPath);

    return {
      backup: preview.backup,
      targetKind: preview.targetKind,
      targetPath: preview.targetPath,
      rollbackSnapshotPath,
    };
  }

  private ensureTargetCompatibility(backup: BackupCatalogResolvedItem, targetKind: RestoreTargetKind): void {
    if (backup.group === 'system') {
      if (targetKind !== 'system') {
        throw new BackupOperationError(400, 'Invalid restore target for system backup. System backups can only restore to system.');
      }
      return;
    }

    if (backup.group === 'plugins') {
      this.ensureScopedTargetCompatibility(backup, targetKind, 'plugin');
      return;
    }

    if (backup.group === 'themes') {
      this.ensureScopedTargetCompatibility(backup, targetKind, 'theme');
      return;
    }

    throw new BackupOperationError(400, 'Invalid restore target for this backup type. Only system, plugin, and theme backups support restore.');
  }

  private async resolveRestoreTarget(input: RestorePreviewInput): Promise<{
    backup: BackupCatalogResolvedItem;
    targetKind: RestoreTargetKind;
    targetLabel: string;
    targetPath: string;
    warnings: string[];
    snapshotType: 'system' | 'plugins' | 'themes';
  }> {
    const backup = await this.catalog.resolveById(input.backupId);
    const targetResolution = this.resolveTarget(input.targetKind);
    this.ensureTargetCompatibility(backup, targetResolution.targetKind);

    return {
      backup,
      targetKind: targetResolution.targetKind,
      targetLabel: targetResolution.targetLabel,
      targetPath: targetResolution.targetPath,
      warnings: this.createWarnings(targetResolution.targetKind, backup.filename),
      snapshotType: targetResolution.snapshotType,
    };
  }

  private resolveTarget(targetKind: RestoreTargetKind): {
    targetKind: RestoreTargetKind;
    targetLabel: string;
    targetPath: string;
    snapshotType: 'system' | 'plugins' | 'themes';
  } {
    if (targetKind === 'system') {
      return {
        targetKind,
        targetLabel: 'System',
        targetPath: ProjectPaths.getProjectRoot(),
        snapshotType: 'system',
      };
    }

    if (targetKind.startsWith('plugin:')) {
      const slug = this.normalizeSlug(targetKind.slice('plugin:'.length));
      const targetPath = path.join(ProjectPaths.getPluginsDir(), slug);
      this.ensureDirectoryExists(targetPath, `Plugin "${slug}" does not exist.`);
      return {
        targetKind: `plugin:${slug}`,
        targetLabel: `Plugin ${slug}`,
        targetPath,
        snapshotType: 'plugins',
      };
    }

    if (targetKind.startsWith('theme:')) {
      const slug = this.normalizeSlug(targetKind.slice('theme:'.length));
      const targetPath = path.join(ProjectPaths.getThemesDir(), slug);
      this.ensureDirectoryExists(targetPath, `Theme "${slug}" does not exist.`);
      return {
        targetKind: `theme:${slug}`,
        targetLabel: `Theme ${slug}`,
        targetPath,
        snapshotType: 'themes',
      };
    }

    throw new BackupOperationError(400, 'Unsupported restore target kind.');
  }

  private createWarnings(targetKind: RestoreTargetKind, backupFilename: string): string[] {
    const warnings = [`Backup archive ${backupFilename} will overwrite files in ${targetKind}.`];
    if (targetKind === 'system') {
      warnings.push('System restore rewrites framework, plugin, theme, and data files under the project root.');
    }
    warnings.push('A pre-restore safety snapshot will be created before extraction begins.');
    return warnings;
  }

  private async createSafetySnapshot(targetKind: RestoreTargetKind, targetPath: string): Promise<string> {
    if (targetKind === 'system') {
      return BackupService.createSystemBackup();
    }

    if (targetKind.startsWith('plugin:')) {
      const slug = this.normalizeSlug(targetKind.slice('plugin:'.length));
      return BackupService.create(slug, targetPath, 'plugins');
    }

    const slug = this.normalizeSlug(targetKind.slice('theme:'.length));
    return BackupService.create(slug, targetPath, 'themes');
  }

  private normalizeSlug(value: string): string {
    const slug = String(value || '').trim().toLowerCase();
    if (!slug || !/^[a-z0-9][a-z0-9-_]*$/.test(slug)) {
      throw new BackupOperationError(400, 'Invalid restore target slug.');
    }
    return slug;
  }

  private ensureDirectoryExists(directoryPath: string, message: string): void {
    if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
      throw new BackupOperationError(409, message);
    }
  }

  private ensureScopedTargetCompatibility(
    backup: BackupCatalogResolvedItem,
    targetKind: RestoreTargetKind,
    scope: 'plugin' | 'theme',
  ): void {
    const backupSlug = this.normalizeSlug(String(backup.scopeSlug || ''));
    if (!targetKind.startsWith(`${scope}:`)) {
      throw new BackupOperationError(400, `Invalid restore target for ${scope} backup. ${this.capitalize(scope)} backups can only restore to ${scope}:${backupSlug}.`);
    }

    const targetSlug = this.normalizeSlug(targetKind.slice(scope.length + 1));
    if (targetSlug !== backupSlug) {
      throw new BackupOperationError(400, `Invalid restore target for ${scope} backup. ${this.capitalize(scope)} backups can only restore to ${scope}:${backupSlug}.`);
    }
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}