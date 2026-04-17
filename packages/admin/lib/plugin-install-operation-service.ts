import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import type { PluginInstallOperation } from './plugin-install-operation.interfaces';

export class PluginInstallOperationService {
  private static readonly POLL_INTERVAL_MS = 800;
  private static readonly TIMEOUT_MS = 10 * 60 * 1000;

  static async startMarketplaceInstall(slug: string): Promise<{ operationId: string; dependencies: string[] }> {
    const response = await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.INSTALL(slug), {}) as {
      operationId?: string;
      dependencies?: string[];
    };

    const operationId = String(response?.operationId || '').trim();
    if (!operationId) {
      throw new Error('Plugin install operation could not be started.');
    }

    return {
      operationId,
      dependencies: Array.isArray(response?.dependencies) ? response.dependencies : [],
    };
  }

  static async startArchiveInstall(uploadId: string): Promise<string> {
    const response = await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.UPLOAD_COMPLETE, { uploadId }) as { operationId?: string };
    const operationId = String(response?.operationId || '').trim();
    if (!operationId) {
      throw new Error('Plugin archive install operation could not be started.');
    }

    return operationId;
  }

  static async waitForCompletion(
    operationId: string,
    onUpdate?: (operation: PluginInstallOperation) => void,
  ): Promise<PluginInstallOperation> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < this.TIMEOUT_MS) {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.INSTALL_OPERATION(operationId)) as {
        operation?: PluginInstallOperation;
      };

      const operation = response?.operation;
      if (!operation) {
        throw new Error('Plugin install operation status is unavailable.');
      }

      onUpdate?.(operation);

      if (operation.status === 'completed') {
        return operation;
      }

      if (operation.status === 'failed') {
        throw new Error(operation.error || operation.message || 'Plugin install failed.');
      }

      await new Promise((resolve) => setTimeout(resolve, this.POLL_INTERVAL_MS));
    }

    throw new Error('Plugin install operation timed out.');
  }
}