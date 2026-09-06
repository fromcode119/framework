import crypto from 'crypto';
import type { IPluginInstallProgress } from '@fromcode119/core';
import type { IPluginInstallOperationState } from '@api/services/interfaces/plugin-install-operation-state.interface';

import { Logger } from '@fromcode119/core';

export class PluginInstallOperationService {
  private static readonly logger = new Logger({ namespace: 'plugin-install' });
  private static readonly TTL_MS = 15 * 60 * 1000;
  private static instance: PluginInstallOperationService | null = null;

  private readonly operations = new Map<string, IPluginInstallOperationState>();

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

    Promise.resolve()
      .then(() => execute(this.reportProgress.bind(this, operation.id)))
      .then(() => this.complete(operation.id))
      .catch((error) => this.fail(operation.id, error));

    return operation;
  }

  get(operationId: string): IPluginInstallOperationState | null {
    this.pruneExpired();
    return this.operations.get(operationId) || null;
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