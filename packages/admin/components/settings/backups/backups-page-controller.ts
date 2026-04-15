'use client';

import React from 'react';
import { NotificationHooks } from '@/components/use-notification';
import type {
  BackupCatalogItemView,
  BackupsPageControllerState,
  RestoreDialogState,
} from './backups-page-client.interfaces';
import { SystemBackupPageUtils } from './system-backup-page-utils';
import { SystemBackupHooks } from './use-system-backups';

export class BackupsPageControllerHooks {
  static useController(): BackupsPageControllerState {
    const { addNotification } = NotificationHooks.useNotification();
    const backupState = SystemBackupHooks.useBackups();
    const [createSections, setCreateSections] = React.useState<('core' | 'database' | 'plugins' | 'themes')[]>(SystemBackupPageUtils.createDefaultSections());
    const [deleteCandidate, setDeleteCandidate] = React.useState<BackupCatalogItemView | null>(null);
    const [restoreState, setRestoreState] = React.useState<RestoreDialogState>(SystemBackupPageUtils.createInitialRestoreState());

    const updateRestoreState = React.useCallback((nextState: Partial<RestoreDialogState>) => {
      setRestoreState((current) => ({ ...current, ...nextState }));
    }, []);

    const handleRefresh = React.useCallback(async () => {
      try {
        await backupState.refreshBackups();
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Refresh Failed',
          message: SystemBackupPageUtils.toErrorMessage(error),
        });
      }
    }, [addNotification, backupState]);

    const handleCreate = React.useCallback(async () => {
      if (!createSections.length) {
        addNotification({
          type: 'error',
          title: 'Select Backup Scope',
          message: 'Choose at least one backup section before creating an archive.',
        });
        return;
      }

      try {
        const response = await backupState.createSystemBackup({ sections: createSections });
        addNotification({
          type: 'success',
          title: 'Backup Created',
          message: `${response.backup.displayName} includes ${SystemBackupPageUtils.describeSections(response.selection.includedSections)}.`,
        });
        if (response.selection.warnings.length) {
          addNotification({
            type: 'error',
            title: 'Backup Completed With Warnings',
            message: response.selection.warnings.join(' '),
          });
        }
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Backup Failed',
          message: SystemBackupPageUtils.toErrorMessage(error),
        });
      }
    }, [addNotification, backupState, createSections]);

    const handleImport = React.useCallback(async (file: File) => {
      try {
        const response = await backupState.importBackup(file);
        addNotification({
          type: 'success',
          title: 'Backup Imported',
          message: `${response.backup.displayName} is now available in managed backups.`,
        });
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Import Failed',
          message: SystemBackupPageUtils.toErrorMessage(error),
        });
      }
    }, [addNotification, backupState]);

    const toggleCreateSection = React.useCallback((value: 'core' | 'database' | 'plugins' | 'themes') => {
      setCreateSections((current) => SystemBackupPageUtils.toggleSection(current, value));
    }, []);

    const applyCreatePreset = React.useCallback((value: 'full' | 'core-db' | 'plugins-only' | 'themes-only') => {
      setCreateSections(SystemBackupPageUtils.applyCreatePreset(value));
    }, []);

    const closeDeleteDialog = React.useCallback(() => {
      setDeleteCandidate(null);
    }, []);

    const handleDelete = React.useCallback(async () => {
      if (!deleteCandidate) return;

      try {
        await backupState.deleteBackup(deleteCandidate.id);
        addNotification({
          type: 'success',
          title: 'Backup Deleted',
          message: `${deleteCandidate.displayName} was removed from managed backups.`,
        });
        closeDeleteDialog();
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Delete Failed',
          message: SystemBackupPageUtils.toErrorMessage(error),
        });
      }
    }, [addNotification, backupState, closeDeleteDialog, deleteCandidate]);

    const handleDownload = React.useCallback(async (id: string) => {
      try {
        const filename = await backupState.downloadBackup(id);
        addNotification({
          type: 'success',
          title: 'Download Started',
          message: `${filename} is being downloaded.`,
        });
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Download Failed',
          message: SystemBackupPageUtils.toErrorMessage(error),
        });
      }
    }, [backupState]);

    const handleRequestDelete = React.useCallback((item: BackupCatalogItemView) => {
      setDeleteCandidate(item);
    }, []);

    const handleRequestRestore = React.useCallback((item: BackupCatalogItemView) => {
      setRestoreState(SystemBackupPageUtils.createRestoreStateForItem(item));
    }, []);

    const closeRestoreDialog = React.useCallback(() => {
      setRestoreState(SystemBackupPageUtils.createInitialRestoreState());
    }, []);

    const updateRestoreTargetScope = React.useCallback((value: 'system' | 'plugin' | 'theme') => {
      updateRestoreState({
        targetScope: value,
        targetSlug: value === 'system' ? '' : restoreState.targetSlug,
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
      if (!targetKind || (restoreState.targetScope !== 'system' && !restoreState.targetSlug.trim())) {
        updateRestoreState({ formError: `A ${restoreState.targetScope} slug is required before preview.` });
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
          type: 'success',
          title: 'Restore Started',
          message: `Rollback snapshot created at ${result.rollbackSnapshotPath}. Reload the admin surface after the filesystem settles.`,
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