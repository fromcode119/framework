import crypto from 'crypto';
import type { PluginInstallProgress } from '@fromcode119/core';
import type { PluginInstallOperationState } from './plugin-install-operation.interfaces';

export class PluginInstallOperationService {
  private static readonly TTL_MS = 15 * 60 * 1000;
  private static instance: PluginInstallOperationService | null = null;

  private readonly operations = new Map<string, PluginInstallOperationState>();

  static getInstance(): PluginInstallOperationService {
    if (!this.instance) {
      this.instance = new PluginInstallOperationService();
    }

    return this.instance;
  }

  start(
    pluginSlug: string,
    kind: string,
    execute: (reportProgress: (progress: PluginInstallProgress) => void) => Promise<void>,
  ): PluginInstallOperationState {
    this.pruneExpired();

    const operation: PluginInstallOperationState = {
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

  get(operationId: string): PluginInstallOperationState | null {
    this.pruneExpired();
    return this.operations.get(operationId) || null;
  }

  private reportProgress(operationId: string, progress: PluginInstallProgress): void {
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
    operation.phase = 'completed';
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