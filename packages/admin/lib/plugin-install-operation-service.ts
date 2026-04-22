import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import type { PluginInstallOperation } from './plugin-install-operation.interfaces';

export class PluginInstallOperationService {
  private static readonly POLL_INTERVAL_MS = 800;
  private static readonly TIMEOUT_MS = 10 * 60 * 1000;
  private static readonly RESTART_RECOVERY_TIMEOUT_MS = 30 * 1000;
  private static readonly RESTART_RECOVERY_POLL_INTERVAL_MS = 1000;

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
    let lastOperation: PluginInstallOperation | null = null;

    while (Date.now() - startedAt < this.TIMEOUT_MS) {
      try {
        const response = await AdminApi.get(
          AdminConstants.ENDPOINTS.PLUGINS.INSTALL_OPERATION(operationId),
          { noDedupe: true },
        ) as {
          operation?: PluginInstallOperation;
        };

        const operation = response?.operation;
        if (!operation) {
          if (this.shouldRecoverFromRestart(lastOperation)) {
            const recoveredOperation = await this.recoverAfterRestart(lastOperation);
            onUpdate?.(recoveredOperation);
            return recoveredOperation;
          }

          throw new Error('Plugin install operation status is unavailable.');
        }

        lastOperation = operation;
        onUpdate?.(operation);

        if (operation.status === 'completed') {
          return operation;
        }

        if (operation.status === 'failed') {
          throw new Error(operation.error || operation.message || 'Plugin install failed.');
        }
      } catch (error) {
        if (this.shouldRecoverFromRestart(lastOperation)) {
          const recoveredOperation = await this.recoverAfterRestart(lastOperation);
          onUpdate?.(recoveredOperation);
          return recoveredOperation;
        }

        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, this.POLL_INTERVAL_MS));
    }

    throw new Error('Plugin install operation timed out.');
  }

  private static shouldRecoverFromRestart(operation: PluginInstallOperation | null): boolean {
    return operation?.phase === 'restart-required';
  }

  private static async recoverAfterRestart(operation: PluginInstallOperation): Promise<PluginInstallOperation> {
    const recoveryStartedAt = Date.now();

    while (Date.now() - recoveryStartedAt < this.RESTART_RECOVERY_TIMEOUT_MS) {
      try {
        await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.HEALTH, { noDedupe: true });

        return {
          ...operation,
          status: 'completed',
          phase: 'completed',
          message: `Plugin "${operation.pluginSlug}" is installed. The API restarted to load the new runtime.`,
          updatedAt: new Date().toISOString(),
        };
      } catch {
        await new Promise((resolve) => setTimeout(resolve, this.RESTART_RECOVERY_POLL_INTERVAL_MS));
      }
    }

    throw new Error(`Plugin "${operation.pluginSlug}" was installed, but the API did not recover after restart.`);
  }
}