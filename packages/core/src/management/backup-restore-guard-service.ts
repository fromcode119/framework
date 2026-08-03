import { BackupSectionKey } from '@core/management/enums/backup-section-key.enum';
import { SnapshotType } from '@core/management/enums/snapshot-type.enum';
import { ExtensionKind } from '@core/plugin/enums/extension-kind.enum';
import { BackupCatalogGroupKey } from '@core/management/enums/backup-catalog-group-key.enum';
import fs from 'fs';
import path from 'path';
import { ProjectPaths } from '@core/config/paths';
import { BackupService } from '@core/management/backup-service';
import { BackupCatalogService } from '@core/management/backup-catalog-service';
import { BackupOperationError } from '@core/management/backup-operation-error';
import { BackupRestorePreviewSessionService } from '@core/management/backup-restore-preview-session-service';
import type { IBackupCatalogResolvedItem } from '@core/management/interfaces/backup-catalog-resolved-item.interface';
import type { IRestoreExecutionInput } from '@core/management/interfaces/restore-execution-input.interface';
import type { IRestoreExecutionResult } from '@core/management/interfaces/restore-execution-result.interface';
import type { IRestorePreviewInput } from '@core/management/interfaces/restore-preview-input.interface';
import type { IRestoreTargetResolution } from '@core/management/interfaces/restore-target-resolution.interface';
import { RestoreTarget } from '@core/management/restore-target';
import { RestoreTargetKind } from '@core/management/enums/restore-target-kind.enum';

export class BackupRestoreGuardService {
  constructor(
    private readonly catalog: BackupCatalogService = new BackupCatalogService(),
    private readonly previewSessions: BackupRestorePreviewSessionService = new BackupRestorePreviewSessionService(),
  ) {}

  async previewRestore(input: IRestorePreviewInput): Promise<IRestoreTargetResolution> {
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

  async executeRestore(input: IRestoreExecutionInput): Promise<IRestoreExecutionResult> {
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

  private ensureTargetCompatibility(backup: IBackupCatalogResolvedItem, target: RestoreTarget): void {
    if (backup.group === BackupCatalogGroupKey.SYSTEM) {
      if (target.kind !== RestoreTargetKind.SYSTEM) {
        throw new BackupOperationError(400, 'Invalid restore target for system backup. System backups can only restore to system.');
      }
      return;
    }

    if (backup.group === BackupCatalogGroupKey.PLUGINS) {
      this.ensureScopedTargetCompatibility(backup, target, ExtensionKind.PLUGIN);
      return;
    }

    if (backup.group === BackupCatalogGroupKey.THEMES) {
      this.ensureScopedTargetCompatibility(backup, target, ExtensionKind.THEME);
      return;
    }

    throw new BackupOperationError(400, 'Invalid restore target for this backup type. Only system, plugin, and theme backups support restore.');
  }

  private async resolveRestoreTarget(input: IRestorePreviewInput): Promise<{
    backup: IBackupCatalogResolvedItem;
    targetKind: RestoreTarget;
    targetLabel: string;
    targetPath: string;
    warnings: string[];
    snapshotType: SnapshotType;
  }> {
    const backup = await this.catalog.resolveById(input.backupId);
    const target = RestoreTarget.parse(input.targetKind);
    if (!target) throw new BackupOperationError(400, 'Unsupported restore target kind.');
    const targetResolution = this.resolveTarget(target);
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

  private resolveTarget(target: RestoreTarget): {
    targetKind: RestoreTarget;
    targetLabel: string;
    targetPath: string;
    snapshotType: SnapshotType;
  } {
    if (target.kind === RestoreTargetKind.SYSTEM) {
      return {
        targetKind: target,
        targetLabel: target.label,
        targetPath: ProjectPaths.getProjectRoot(),
        snapshotType: SnapshotType.SYSTEM,
      };
    }

    const slug = this.normalizeSlug(target.slug ?? '');
    const isPlugin = target.kind === RestoreTargetKind.PLUGIN;
    const targetPath = path.join(
      isPlugin ? ProjectPaths.getPluginsDir() : ProjectPaths.getThemesDir(),
      slug,
    );
    this.ensureDirectoryExists(targetPath, `${isPlugin ? 'Plugin' : 'Theme'} "${slug}" does not exist.`);
    const normalized = isPlugin ? RestoreTarget.plugin(slug) : RestoreTarget.theme(slug);
    return {
      targetKind: normalized,
      targetLabel: normalized.label,
      targetPath,
      snapshotType: isPlugin ? SnapshotType.PLUGINS : SnapshotType.THEMES,
    };
  }

  private createWarnings(target: RestoreTarget, backupFilename: string): string[] {
    const warnings = [`Backup archive ${backupFilename} will overwrite files in ${target}.`];
    if (target.kind === RestoreTargetKind.SYSTEM) {
      warnings.push('System restore rewrites framework, plugin, theme, and data files under the project root.');
    }
    warnings.push('A pre-restore safety snapshot will be created before extraction begins.');
    return warnings;
  }

  private async createSafetySnapshot(target: RestoreTarget, targetPath: string): Promise<string> {
    if (target.kind === RestoreTargetKind.SYSTEM) {
      return BackupService.createSystemBackup();
    }

    const slug = this.normalizeSlug(target.slug ?? '');
    const section = target.kind === RestoreTargetKind.PLUGIN ? BackupSectionKey.PLUGINS : BackupSectionKey.THEMES;
    return BackupService.create(slug, targetPath, section);
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
    backup: IBackupCatalogResolvedItem,
    target: RestoreTarget,
    scope: ExtensionKind,
  ): void {
    const backupSlug = this.normalizeSlug(String(backup.scopeSlug || ''));
    // Kind and slug are separate fields now, so this is two comparisons rather than a prefix test plus
    // a `slice(scope.length + 1)` that had to know the wire format.
    const sameKind = target.kind.value === scope.value;
    const sameSlug = sameKind && this.normalizeSlug(target.slug ?? '') === backupSlug;
    if (!sameKind || !sameSlug) {
      throw new BackupOperationError(400, `Invalid restore target for ${scope} backup. ${this.capitalize(scope.value)} backups can only restore to ${scope}:${backupSlug}.`);
    }
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}