import { RestoreTargetScope } from '@/components/settings/backups/enums/restore-target-scope.enum';
import { BackupPreset } from '@/components/settings/backups/enums/backup-preset.enum';
import { BackupSectionKey } from '@fromcode119/core';
import { NotificationType } from '@/components/enums/notification-type.enum';
import React from 'react';
import { NotificationHooks } from '@/components/view/use-notification.client';
import type { IBackupCatalogItemView } from '@/components/settings/backups/interfaces/backup-catalog-item-view.interface';
import type { IBackupsPageControllerState } from '@/components/settings/backups/interfaces/backups-page-controller-state.interface';
import type { IRestoreDialogState } from '@/components/settings/backups/interfaces/restore-dialog-state.interface';
import { SystemBackupPageUtils } from '@/components/settings/backups/system-backup-page-utils';
import { SystemBackupHooks } from '@/components/settings/backups/view/use-system-backups.client';
import { BackupSectionOptions } from '@/components/settings/backups/backup-section-options';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class BackupsPageControllerHooks {
  static useController(): IBackupsPageControllerState {
    const { addNotification } = NotificationHooks.useNotification();
    const backupState = SystemBackupHooks.useBackups();
    const [createSections, setCreateSections] = React.useState<BackupSectionKey[]>(BackupSectionOptions.createDefaultSections());
    const [deleteCandidate, setDeleteCandidate] = React.useState<IBackupCatalogItemView | null>(null);
    const [restoreState, setRestoreState] = React.useState<IRestoreDialogState>(SystemBackupPageUtils.createInitialRestoreState());

    const updateRestoreState = React.useCallback((nextState: Partial<IRestoreDialogState>) => {
      setRestoreState((current) => ({ ...current, ...nextState }));
    }, []);

    const handleRefresh = React.useCallback(async () => {
      try {
        await backupState.refreshBackups();
      } catch (error) {
        addNotification({
          type: NotificationType.ERROR,
          title: AdminI18n.t('settings.components.refreshFailed'),
          message: SystemBackupPageUtils.toErrorMessage(error),
        });
      }
    }, [addNotification, backupState]);

    const handleCreate = React.useCallback(async () => {
      if (!createSections.length) {
        addNotification({
          type: NotificationType.ERROR,
          title: AdminI18n.t('settings.components.selectBackupScope'),
          message: AdminI18n.t('settings.components.chooseAtLeastOneBackup'),
        });
        return;
      }

      try {
        const response = await backupState.createSystemBackup({ sections: createSections });
        addNotification({
          type: NotificationType.SUCCESS,
          title: AdminI18n.t('settings.components.backupCreated'),
          message: `${response.backup.displayName} includes ${BackupSectionOptions.describeSections(response.selection.includedSections)}.`,
        });
        if (response.selection.warnings.length) {
          addNotification({
            type: NotificationType.ERROR,
            title: AdminI18n.t('settings.components.backupCompletedWithWarnings'),
            message: response.selection.warnings.join(' '),
          });
        }
      } catch (error) {
        addNotification({
          type: NotificationType.ERROR,
          title: AdminI18n.t('settings.components.backupFailed'),
          message: SystemBackupPageUtils.toErrorMessage(error),
        });
      }
    }, [addNotification, backupState, createSections]);

    const handleImport = React.useCallback(async (file: File) => {
      try {
        const response = await backupState.importBackup(file);
        addNotification({
          type: NotificationType.SUCCESS,
          title: AdminI18n.t('settings.components.backupImported'),
          message: AdminI18n.t('settings.components.isNowAvailableInManaged', { displayName: response.backup.displayName }),
        });
      } catch (error) {
        addNotification({
          type: NotificationType.ERROR,
          title: AdminI18n.t('settings.components.importFailed'),
          message: SystemBackupPageUtils.toErrorMessage(error),
        });
      }
    }, [addNotification, backupState]);

    const toggleCreateSection = React.useCallback((value: BackupSectionKey) => {
      setCreateSections((current) => BackupSectionOptions.toggleSection(current, value));
    }, []);

    const applyCreatePreset = React.useCallback((value: BackupPreset) => {
      setCreateSections(BackupSectionOptions.applyCreatePreset(value));
    }, []);

    const closeDeleteDialog = React.useCallback(() => {
      setDeleteCandidate(null);
    }, []);

    const handleDelete = React.useCallback(async () => {
      if (!deleteCandidate) return;

      try {
        await backupState.deleteBackup(deleteCandidate.id);
        addNotification({
          type: NotificationType.SUCCESS,
          title: AdminI18n.t('settings.components.backupDeleted'),
          message: AdminI18n.t('settings.components.wasRemovedFromManagedBackups', { displayName: deleteCandidate.displayName }),
        });
        closeDeleteDialog();
      } catch (error) {
        addNotification({
          type: NotificationType.ERROR,
          title: AdminI18n.t('settings.components.deleteFailed'),
          message: SystemBackupPageUtils.toErrorMessage(error),
        });
      }
    }, [addNotification, backupState, closeDeleteDialog, deleteCandidate]);

    const handleDownload = React.useCallback(async (id: string) => {
      try {
        const filename = await backupState.downloadBackup(id);
        addNotification({
          type: NotificationType.SUCCESS,
          title: AdminI18n.t('settings.components.downloadStarted'),
          message: AdminI18n.t('settings.components.isBeingDownloaded', { filename: filename }),
        });
      } catch (error) {
        addNotification({
          type: NotificationType.ERROR,
          title: AdminI18n.t('settings.components.downloadFailed'),
          message: SystemBackupPageUtils.toErrorMessage(error),
        });
      }
    }, [backupState]);

    const handleRequestDelete = React.useCallback((item: IBackupCatalogItemView) => {
      setDeleteCandidate(item);
    }, []);

    const handleRequestRestore = React.useCallback((item: IBackupCatalogItemView) => {
      setRestoreState(SystemBackupPageUtils.createRestoreStateForItem(item));
    }, []);

    const closeRestoreDialog = React.useCallback(() => {
      setRestoreState(SystemBackupPageUtils.createInitialRestoreState());
    }, []);

    const updateRestoreTargetScope = React.useCallback((value: RestoreTargetScope) => {
      updateRestoreState({
        targetScope: value,
        targetSlug: value === RestoreTargetScope.SYSTEM ? '' : restoreState.targetSlug,
        preview: null,
        confirmationText: '',
        formError: '',
      });
    }, [restoreState.targetSlug, updateRestoreState]);

    const updateRestoreTargetSlug = React.useCallback((value: string) => {
      updateRestoreState({ targetSlug: value, preview: null, confirmationText: '', formError: '' });
    }, [updateRestoreState]);

    const updateRestoreConfirmationText = React.useCallback((value: string) => {
      updateRestoreState({ confirmationText: value, formError: '' });
    }, [updateRestoreState]);

    const handlePreviewRestore = React.useCallback(async () => {
      if (!restoreState.backup) return;

      const targetKind = SystemBackupPageUtils.buildTargetKind(restoreState.targetScope, restoreState.targetSlug);
      if (!targetKind || (restoreState.targetScope !== RestoreTargetScope.SYSTEM && !restoreState.targetSlug.trim())) {
        updateRestoreState({ formError: AdminI18n.t('settings.components.aSlugIsRequiredBefore', { targetScope: restoreState.targetScope }) });
        return;
      }

      try {
        const preview = await backupState.previewRestore(restoreState.backup.id, targetKind);
        updateRestoreState({ preview, confirmationText: '', formError: '' });
      } catch (error) {
        updateRestoreState({
          formError: SystemBackupPageUtils.toErrorMessage(error),
          preview: null,
          confirmationText: '',
        });
      }
    }, [backupState, restoreState.backup, restoreState.targetScope, restoreState.targetSlug, updateRestoreState]);

    const handleExecuteRestore = React.useCallback(async () => {
      if (!restoreState.backup || !restoreState.preview) return;

      const targetKind = SystemBackupPageUtils.buildTargetKind(restoreState.targetScope, restoreState.targetSlug);
      try {
        const result = await backupState.executeRestore(
          restoreState.backup.id,
          targetKind,
          restoreState.preview.previewToken,
          restoreState.confirmationText,
        );
        addNotification({
          type: NotificationType.SUCCESS,
          title: AdminI18n.t('settings.components.restoreStarted'),
          message: AdminI18n.t('settings.components.rollbackSnapshotCreatedAtReload', { rollbackSnapshotPath: result.rollbackSnapshotPath }),
        });
        closeRestoreDialog();
      } catch (error) {
        updateRestoreState({ formError: SystemBackupPageUtils.toErrorMessage(error) });
      }
    }, [addNotification, backupState, closeRestoreDialog, restoreState.backup, restoreState.confirmationText, restoreState.preview, restoreState.targetScope, restoreState.targetSlug, updateRestoreState]);

    return {
      backupState,
      createSections,
      deleteCandidate,
      restoreState,
      handleRefresh,
      handleCreate,
      handleImport,
      handleDelete,
      handleDownload,
      toggleCreateSection,
      applyCreatePreset,
      handleRequestDelete,
      handleRequestRestore,
      closeDeleteDialog,
      closeRestoreDialog,
      updateRestoreTargetScope,
      updateRestoreTargetSlug,
      updateRestoreConfirmationText,
      handlePreviewRestore,
      handleExecuteRestore,
    };
  }
}