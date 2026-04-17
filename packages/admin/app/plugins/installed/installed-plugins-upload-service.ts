import type { UploadPreviewSection } from '@/components/ui/upload-preview-dialog.interfaces';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';

export class InstalledPluginsUploadService {
  private static readonly MAX_CHUNK_RETRIES = 3;

  static isSupportedArchive(file?: File | null): boolean {
    const normalized = String(file?.name || '').trim().toLowerCase();
    return normalized.endsWith('.zip') || normalized.endsWith('.tar.gz') || normalized.endsWith('.tgz');
  }

  static formatBytes(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }

    return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
  }

  static buildUploadProgressLabel(loadedBytes: number, totalBytes: number, percent: number, stalled = false): string {
    const bytesLabel = `${InstalledPluginsUploadService.formatBytes(loadedBytes)} of ${InstalledPluginsUploadService.formatBytes(totalBytes)}`;
    if (loadedBytes <= 0) {
      return `Preparing plugin upload... ${bytesLabel}`;
    }
    if (percent >= 99) {
      return `Upload finished. Inspecting plugin package... ${bytesLabel}`;
    }
    if (stalled) {
      return `Uploading plugin package... ${bytesLabel}. Progress updates may pause for large files.`;
    }
    return `Uploading plugin package... ${bytesLabel}`;
  }

  static normalizeUploadPercent(loadedBytes: number, totalBytes: number): number {
    if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
      return 0;
    }

    const rawPercent = Math.round((loadedBytes / totalBytes) * 100);
    if (loadedBytes >= totalBytes) {
      return 99;
    }

    return Math.max(0, Math.min(99, rawPercent));
  }

  static shouldRetryChunk(error: unknown, attempt: number): boolean {
    if (attempt >= InstalledPluginsUploadService.MAX_CHUNK_RETRIES) {
      return false;
    }

    const status = InstalledPluginsUploadService.readStatus(error);
    if (status === 408 || status === 409 || status === 425 || status === 429) {
      return true;
    }

    return status >= 500 || status === 0;
  }

  static async waitBeforeRetry(attempt: number): Promise<void> {
    const delayMs = attempt * 1000;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  static buildPreviewSections(info: any): UploadPreviewSection[] {
    const dependencies = Array.isArray(info?.dependencies) ? info.dependencies : [];
    const peerDependencies = Array.isArray(info?.peerDependencies) ? info.peerDependencies : [];
    const existing = info?.existing || { installed: false };

    return [
      {
        title: 'Summary',
        items: [
          `Name: ${info?.name || 'Unknown'}`,
          `Slug: ${info?.slug || 'Unknown'}`,
          `Version: ${info?.version || 'Unknown'}`,
          `Files: ${info?.files ?? 'Unknown'}`,
          `UI bundle: ${info?.hasUiBundle ? 'Yes' : 'No'}`,
        ],
      },
      {
        title: 'Dependencies',
        items: dependencies.length ? dependencies : ['No required plugin dependencies'],
      },
      {
        title: 'Peer Dependencies',
        items: peerDependencies.length ? peerDependencies : ['No peer dependencies'],
      },
      {
        title: 'Install Impact',
        items: existing.installed
          ? [
            `This will replace installed plugin "${info?.slug}".`,
            `Current version: ${existing.version || 'Unknown'} (${existing.state || 'unknown'})`,
            `Incoming version: ${info?.version || 'Unknown'}`,
          ]
          : ['This plugin is not currently installed.'],
      },
    ];
  }

  static async stageArchive(
    file: File,
    options: {
      chunkSizeBytes: number;
      onProgress: (label: string, percent: number) => void;
    },
  ): Promise<string> {
    const estimatedChunkSize = options.chunkSizeBytes;
    const estimatedTotalChunks = Math.max(1, Math.ceil(file.size / estimatedChunkSize));
    let stallTimerId: number | null = null;

    const clearStallTimer = () => {
      if (stallTimerId !== null) {
        window.clearTimeout(stallTimerId);
        stallTimerId = null;
      }
    };

    const pushProgress = (loadedBytes: number, percent: number, stalled = false) => {
      options.onProgress(
        InstalledPluginsUploadService.buildUploadProgressLabel(loadedBytes, file.size, percent, stalled),
        percent,
      );
    };

    const scheduleStallNotice = (loadedBytes: number, percent: number) => {
      clearStallTimer();
      stallTimerId = window.setTimeout(() => {
        pushProgress(loadedBytes, percent, true);
      }, 4000);
    };

    pushProgress(0, 0);

    try {
      const session = await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.UPLOAD_SESSION, {
        originalFilename: file.name,
        totalSizeBytes: file.size,
        totalChunks: estimatedTotalChunks,
      }) as { uploadId?: string; chunkSizeBytes?: number; totalChunks?: number };
      const uploadId = String(session?.uploadId || '').trim();
      if (!uploadId) {
        throw new Error('Upload session could not be created.');
      }

      const chunkSizeBytes = Math.max(1, Number(session?.chunkSizeBytes || estimatedChunkSize));
      const totalChunks = Math.max(1, Number(session?.totalChunks || estimatedTotalChunks));
      let uploadedBytes = 0;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        const chunkStart = chunkIndex * chunkSizeBytes;
        const chunkEnd = Math.min(file.size, chunkStart + chunkSizeBytes);
        const formData = new FormData();
        formData.append('chunk', file.slice(chunkStart, chunkEnd), `${file.name}.part-${chunkIndex}`);
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', String(chunkIndex));
        formData.append('totalChunks', String(totalChunks));

        let attempt = 0;
        while (true) {
          attempt += 1;
          try {
            await AdminApi.upload(AdminConstants.ENDPOINTS.PLUGINS.UPLOAD_CHUNK, formData, {
              onProgress: (state) => {
                const loadedBytes = Math.min(file.size, uploadedBytes + state.loadedBytes);
                const percent = InstalledPluginsUploadService.normalizeUploadPercent(loadedBytes, file.size);
                pushProgress(loadedBytes, percent);
                scheduleStallNotice(loadedBytes, percent);
              },
            });
            break;
          } catch (error) {
            if (!InstalledPluginsUploadService.shouldRetryChunk(error, attempt)) {
              throw error;
            }

            options.onProgress(
              `Retrying chunk ${chunkIndex + 1} of ${totalChunks} after ${InstalledPluginsUploadService.toErrorMessage(error)}`,
              InstalledPluginsUploadService.normalizeUploadPercent(uploadedBytes, file.size),
            );
            await InstalledPluginsUploadService.waitBeforeRetry(attempt);
          }
        }

        uploadedBytes = chunkEnd;
      }

      clearStallTimer();
      pushProgress(file.size, 99);
      return uploadId;
    } finally {
      clearStallTimer();
    }
  }

  static toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return String(error || 'Upload failed.');
  }

  private static readStatus(error: unknown): number {
    if (!error || typeof error !== 'object') {
      return 0;
    }

    const value = Number((error as { status?: unknown }).status || 0);
    return Number.isFinite(value) ? value : 0;
  }
}
