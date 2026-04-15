'use client';

import React from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import type {
  RestoreExecuteResponseView,
  RestorePreviewResponseView,
  BackupDownloadProgressView,
  BackupProgressView,
  SystemBackupHookState,
  SystemBackupListResponseView,
  SystemBackupMutationResponseView,
} from './backups-page-client.interfaces';
import { SystemBackupPageUtils } from './system-backup-page-utils';

export class SystemBackupHooks {
  private static readonly BACKUP_IMPORT_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;

  static useBackups(): SystemBackupHookState {
    const [groups, setGroups] = React.useState<SystemBackupListResponseView['groups']>([]);
    const [capabilities, setCapabilities] = React.useState(SystemBackupPageUtils.createEmptyListResponse().capabilities);
    const [errorMessage, setErrorMessage] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [isCreating, setIsCreating] = React.useState(false);
    const [isImporting, setIsImporting] = React.useState(false);
    const [createProgress, setCreateProgress] = React.useState<BackupProgressView | null>(null);
    const [importProgress, setImportProgress] = React.useState<BackupProgressView | null>(null);
    const [downloadProgress, setDownloadProgress] = React.useState<BackupDownloadProgressView | null>(null);
    const [activeDeleteId, setActiveDeleteId] = React.useState('');
    const [activePreviewId, setActivePreviewId] = React.useState('');
    const [activeRestoreId, setActiveRestoreId] = React.useState('');

    const refreshBackups = React.useCallback(async (options?: { initial?: boolean }): Promise<SystemBackupListResponseView> => {
      const initial = options?.initial === true;

      if (initial) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.BACKUPS, { noDedupe: true }) as SystemBackupListResponseView;
        setGroups(Array.isArray(response?.groups) ? response.groups : []);
        setCapabilities(response?.capabilities || SystemBackupPageUtils.createEmptyListResponse().capabilities);
        setErrorMessage('');
        return response;
      } catch (error) {
        setErrorMessage(SystemBackupPageUtils.toErrorMessage(error));
        throw error;
      } finally {
        if (initial) {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    }, []);

    React.useEffect(() => {
      void refreshBackups({ initial: true }).catch(() => undefined);
    }, [refreshBackups]);

    const createSystemBackup = React.useCallback(async (
      request: { sections: ('core' | 'database' | 'plugins' | 'themes')[] },
    ): Promise<SystemBackupMutationResponseView> => {
      setIsCreating(true);
      setCreateProgress({ percent: 8, label: SystemBackupPageUtils.getCreateProgressLabel(8) });
      const progressTimer = window.setInterval(() => {
        setCreateProgress((current) => {
          if (!current) {
            return current;
          }
          const nextPercent = SystemBackupPageUtils.getNextCreateProgressPercent(current.percent);
          return {
            percent: nextPercent,
            label: SystemBackupPageUtils.getCreateProgressLabel(nextPercent),
          };
        });
      }, 420);
      try {
        const response = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.BACKUP_CREATE_SYSTEM, request) as SystemBackupMutationResponseView;
        setCreateProgress({ percent: 92, label: SystemBackupPageUtils.getCreateProgressLabel(92) });
        await refreshBackups();
        setCreateProgress({ percent: 100, label: SystemBackupPageUtils.getCreateProgressLabel(100) });
        window.setTimeout(() => setCreateProgress(null), 1200);
        return response;
      } catch (error) {
        setCreateProgress(null);
        throw error;
      } finally {
        window.clearInterval(progressTimer);
        setIsCreating(false);
      }
    }, [refreshBackups]);

    const importBackup = React.useCallback(async (file: File): Promise<SystemBackupMutationResponseView> => {
      if (!(file instanceof File)) {
        throw new Error('Choose a backup archive to import.');
      }

      setIsImporting(true);
      setImportProgress({
        percent: 0,
        label: SystemBackupPageUtils.getImportUploadLabel(0, file.size, 0),
      });
      let lastLoadedBytes = 0;
      let stallTimer: number | null = null;
      const clearStallTimer = () => {
        if (stallTimer !== null) {
          window.clearTimeout(stallTimer);
          stallTimer = null;
        }
      };
      const scheduleStallNotice = (loadedBytes: number, percent: number) => {
        clearStallTimer();
        stallTimer = window.setTimeout(() => {
          setImportProgress((current) => {
            if (!current || current.percent >= 96) {
              return current;
            }
            return {
              percent,
              label: SystemBackupPageUtils.getImportUploadLabel(loadedBytes, file.size, percent, true),
            };
          });
        }, 4000);
      };
      try {
        const estimatedChunkSize = SystemBackupHooks.BACKUP_IMPORT_CHUNK_SIZE_BYTES;
        const estimatedTotalChunks = Math.max(1, Math.ceil(file.size / estimatedChunkSize));
        const session = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.BACKUP_IMPORT_SESSION, {
          originalFilename: file.name,
          totalSizeBytes: file.size,
          totalChunks: estimatedTotalChunks,
        }) as { uploadId: string; chunkSizeBytes?: number; totalChunks?: number };
        const chunkSizeBytes = Math.max(1, Number(session?.chunkSizeBytes || estimatedChunkSize));
        const totalChunks = Math.max(1, Number(session?.totalChunks || estimatedTotalChunks));
        let uploadedBytes = 0;

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
          const chunkStart = chunkIndex * chunkSizeBytes;
          const chunkEnd = Math.min(file.size, chunkStart + chunkSizeBytes);
          const formData = new FormData();
          formData.append('chunk', file.slice(chunkStart, chunkEnd), `${file.name}.part-${chunkIndex}`);
          formData.append('uploadId', String(session.uploadId || ''));
          formData.append('chunkIndex', String(chunkIndex));
          formData.append('totalChunks', String(totalChunks));

          await AdminApi.upload(AdminConstants.ENDPOINTS.SYSTEM.BACKUP_IMPORT_CHUNK, formData, {
            onProgress: (state) => {
              const loadedBytes = Math.min(file.size, uploadedBytes + state.loadedBytes);
              lastLoadedBytes = loadedBytes;
              const percent = SystemBackupPageUtils.normalizeUploadPercent(loadedBytes, file.size, file.size ? (loadedBytes / file.size) * 100 : 0);
              setImportProgress({
                percent,
                label: SystemBackupPageUtils.getImportUploadLabel(loadedBytes, file.size, percent),
              });
              scheduleStallNotice(loadedBytes, percent);
            },
          });

          uploadedBytes = chunkEnd;
        }

        const response = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.BACKUP_IMPORT_COMPLETE, {
          uploadId: String(session.uploadId || ''),
        }) as SystemBackupMutationResponseView;
        clearStallTimer();
        setImportProgress({ percent: 96, label: 'Upload finished. Saving archive and refreshing inventory...' });
        await refreshBackups();
        setImportProgress({ percent: 100, label: `${response.backup.displayName} imported successfully.` });
        window.setTimeout(() => setImportProgress(null), 1600);
        return response;
      } catch (error) {
        clearStallTimer();
        if (lastLoadedBytes > 0) {
          setImportProgress({
            percent: 0,
            label: `Upload stopped after ${SystemBackupPageUtils.formatBytes(lastLoadedBytes)}. ${SystemBackupPageUtils.toErrorMessage(error)}`,
          });
          window.setTimeout(() => setImportProgress(null), 2600);
        } else {
          setImportProgress(null);
        }
        throw error;
      } finally {
        clearStallTimer();
        setIsImporting(false);
      }
    }, [refreshBackups]);

    const deleteBackup = React.useCallback(async (id: string): Promise<SystemBackupMutationResponseView> => {
      setActiveDeleteId(id);
      try {
        const response = await AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.BACKUP(id)) as SystemBackupMutationResponseView;
        await refreshBackups();
        return response;
      } finally {
        setActiveDeleteId('');
      }
    }, [refreshBackups]);

    const downloadBackup = React.useCallback(async (id: string): Promise<string> => {
      let latestLoadedBytes = 0;
      let latestTotalBytes: number | null = null;
      setDownloadProgress({
        activeId: id,
        percent: 0,
        label: 'Starting download...',
        loadedBytes: 0,
        totalBytes: null,
      });
      try {
        const filename = await SystemBackupPageUtils.downloadBackup(id, (state) => {
          latestLoadedBytes = state.loadedBytes;
          latestTotalBytes = state.totalBytes;
          setDownloadProgress({
            activeId: id,
            percent: state.percent,
            label: state.percent === 100 ? 'Finalizing download...' : state.percent === null ? 'Downloading archive...' : `Downloading ${state.percent}%`,
            loadedBytes: state.loadedBytes,
            totalBytes: state.totalBytes,
          });
        });
        setDownloadProgress({
          activeId: id,
          percent: 100,
          label: `${filename} downloaded.`,
          loadedBytes: latestLoadedBytes,
          totalBytes: latestTotalBytes,
        });
        window.setTimeout(() => setDownloadProgress(null), 1200);
        return filename;
      } catch (error) {
        setDownloadProgress(null);
        throw error;
      }
    }, []);

    const previewRestore = React.useCallback(async (id: string, targetKind: string): Promise<RestorePreviewResponseView> => {
      setActivePreviewId(id);
      try {
        return await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.BACKUP_RESTORE_PREVIEW(id), {
          targetKind,
        }) as RestorePreviewResponseView;
      } finally {
        setActivePreviewId('');
      }
    }, []);

    const executeRestore = React.useCallback(async (
      id: string,
      targetKind: string,
      previewToken: string,
      confirmationText: string,
    ): Promise<RestoreExecuteResponseView> => {
      setActiveRestoreId(id);
      try {
        const response = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.BACKUP_RESTORE_EXECUTE(id), {
          targetKind,
          previewToken,
          confirmationText,
        }) as RestoreExecuteResponseView;
        await refreshBackups();
        return response;
      } finally {
        setActiveRestoreId('');
      }
    }, [refreshBackups]);

    return {
      groups,
      capabilities,
      errorMessage,
      isLoading,
      isRefreshing,
      isCreating,
      isImporting,
      createProgress,
      importProgress,
      downloadProgress,
      activeDeleteId,
      activePreviewId,
      activeRestoreId,
      refreshBackups,
      createSystemBackup,
      importBackup,
      deleteBackup,
      downloadBackup,
      previewRestore,
      executeRestore,
    };
  }
}