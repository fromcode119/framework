import crypto from 'crypto';
import type { IPluginInstallProgress } from '@fromcode119/core';
import type { IPluginInstallOperationState } from '@api/services/interfaces/plugin-install-operation-state.interface';

import { Logger } from '@fromcode119/core';

export class PluginInstallOperationService {
  private static readonly logger = new Logger({ namespace: 'plugin-install' });
  private static readonly TTL_MS = 15 * 60 * 1000;
  private static instance: PluginInstallOperationService | null = null;

  private readonly operations = new Map<string, IPluginInstallOperationState>();
  /**
   * With several api workers, the admin's progress poll can reach a worker that is not running the
   * operation. Each change is copied here, where every worker can read it.
   */
  private shared: { get(key: string): Promise<any>; set(key: string, value: unknown, ttlSeconds?: number): Promise<void> } | null = null;

  useSharedStore(store: { get(key: string): Promise<any>; set(key: string, value: unknown, ttlSeconds?: number): Promise<void> }): void {
    this.shared = store;
  }

  static getInstance(): PluginInstallOperationService {
    if (!this.instance) {
      this.instance = new PluginInstallOperationService();
    }

    return this.instance;
  }

  start(
    pluginSlug: string,
    kind: string,
    execute: (reportProgress: (progress: IPluginInstallProgress) => void) => Promise<void>,
  ): IPluginInstallOperationState {
    this.pruneExpired();

    const operation: IPluginInstallOperationState = {
      id: crypto.randomUUID(),
      pluginSlug,
      kind,
      status: 'running',
      phase: 'queued',
      message: `Starting ${kind} for "${pluginSlug}"...`,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dependencySlugs: [],
      migrationNames: [],
    };

    this.operations.set(operation.id, operation);
    this.share(operation);

    Promise.resolve()
      .then(() => execute(this.reportProgress.bind(this, operation.id)))
      .then(() => this.complete(operation.id))
      .catch((error) => this.fail(operation.id, error));

    return operation;
  }

  /** This worker's own record, else the copy another worker shared. */
  async get(operationId: string): Promise<IPluginInstallOperationState | null> {
    this.pruneExpired();
    const local = this.operations.get(operationId);
    if (local) return local;
    if (!this.shared) return null;
    return (await this.shared.get(PluginInstallOperationService.sharedKey(operationId)).catch(() => null)) || null;
  }

  private static sharedKey(operationId: string): string {
    return `plugin-install-operation:${operationId}`;
  }

  private share(operation: IPluginInstallOperationState): void {
    if (!this.shared) return;
    this.shared.set(PluginInstallOperationService.sharedKey(operation.id), operation, PluginInstallOperationService.TTL_MS / 1000)
      .catch((error: unknown) => PluginInstallOperationService.logger.warn(`Could not share progress of ${operation.kind} for "${operation.pluginSlug}": ${String((error as Error)?.message ?? error)}`));
  }

  private reportProgress(operationId: string, progress: IPluginInstallProgress): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return;
    }

    operation.phase = progress.phase;
    operation.message = progress.message;
    operation.updatedAt = new Date().toISOString();

    if (progress.dependencySlug && !operation.dependencySlugs.includes(progress.dependencySlug)) {
      operation.dependencySlugs = [...operation.dependencySlugs, progress.dependencySlug];
    }

    if (progress.migrationName && !operation.migrationNames.includes(progress.migrationName)) {
      operation.migrationNames = [...operation.migrationNames, progress.migrationName];
    }
    this.share(operation);
  }

  private complete(operationId: string): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return;
    }

    operation.status = 'completed';
    // The execute fn SCHEDULES the process restart and returns — the restart is still ~2.5s away
    // when this runs. The phase is the only signal clients key restart-recovery on; overwriting it
    // made a batch update look fully done while the api was about to go down for a minute.
    if (operation.phase !== 'restart-required') {
      operation.phase = 'completed';
    }
    operation.message = operation.message || `Completed ${operation.kind} for "${operation.pluginSlug}".`;
    operation.updatedAt = new Date().toISOString();
    this.share(operation);
  }

  private fail(operationId: string, error: unknown): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return;
    }

    operation.status = 'failed';
    operation.phase = 'failed';
    operation.error = error instanceof Error ? error.message : String(error);
    operation.message = operation.error;
    operation.updatedAt = new Date().toISOString();
    // The admin polls this record and shows the message; the LOG must say it too, or a failed install
    // leaves no trace once the operation is pruned from memory.
    PluginInstallOperationService.logger.warn(`${operation.kind} for "${operation.pluginSlug}" failed: ${operation.error}`);
    this.share(operation);
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [operationId, operation] of this.operations.entries()) {
      const updatedAt = new Date(operation.updatedAt).getTime();
      if (Number.isFinite(updatedAt) && now - updatedAt > PluginInstallOperationService.TTL_MS) {
        this.operations.delete(operationId);
      }
    }
  }
}