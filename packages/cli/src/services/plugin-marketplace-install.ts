import semver from 'semver';
import { ApiPathUtils, RouteConstants, SystemConstants } from '@fromcode119/core';
import type { RunningPlatformApi } from '@cli/services/running-platform-api';

/**
 * Installing or updating a plugin from the marketplace, as the admin's Install / Update button does:
 * the running api starts the operation, and this follows it until it is done. One path for both, so a
 * plugin updated from a terminal is verified, recorded and swapped in exactly as one updated on screen.
 */
export class PluginMarketplaceInstall {
  static readonly POLL_INTERVAL_MS = 1000;
  static readonly TIMEOUT_MS = 10 * 60 * 1000;

  constructor(
    private readonly api: RunningPlatformApi,
    private readonly wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  /** Starts the install of `slug` (the latest, or `version`) and resolves with the finished operation. */
  async run(slug: string, version: string | undefined, onStatus: (line: string) => void): Promise<Record<string, any>> {
    const path = ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.INSTALL, { slug });
    const started = await this.api.post<{ operationId?: string; dependencies?: string[] }>(
      version ? `${path}?version=${encodeURIComponent(version)}` : path,
    );
    const operationId = String(started?.operationId || '').trim();
    if (!operationId) throw new Error(`The platform did not start an install of "${slug}".`);
    if (started?.dependencies?.length) onStatus(`dependencies: ${started.dependencies.join(', ')}`);
    return this.follow(operationId, onStatus);
  }

  /** The version the running platform reports for `slug`, '' when it does not list it. */
  async installedVersion(slug: string): Promise<string> {
    return (await this.installed()).find((row) => row.manifest?.slug === slug)?.manifest?.version || '';
  }

  /** Installed plugins whose marketplace version is newer — the list the admin marks "Update". */
  async outdated(): Promise<Array<{ slug: string; current: string; latest: string }>> {
    const installed = await this.installed();
    const catalog = await this.api.get<{ plugins?: Array<{ slug?: string; version?: string }> }>(SystemConstants.API_PATH.PLUGINS.MARKETPLACE);
    const latest = new Map((catalog?.plugins || []).map((entry) => [String(entry.slug), String(entry.version || '')]));
    return installed
      .map((row) => ({ slug: String(row.manifest?.slug || ''), current: String(row.manifest?.version || ''), latest: latest.get(String(row.manifest?.slug || '')) || '' }))
      .filter((row) => row.slug && PluginMarketplaceInstall.isNewer(row.latest, row.current));
  }

  private async installed(): Promise<Array<{ manifest?: { slug?: string; version?: string } }>> {
    const rows = await this.api.get<Array<{ manifest?: { slug?: string; version?: string } }>>(SystemConstants.API_PATH.PLUGINS.BASE);
    return Array.isArray(rows) ? rows : [];
  }

  static isNewer(latest: string, current: string): boolean {
    const a = semver.coerce(latest);
    const b = semver.coerce(current);
    return Boolean(a && b && semver.gt(a, b));
  }

  private async follow(operationId: string, onStatus: (line: string) => void): Promise<Record<string, any>> {
    const path = ApiPathUtils.fillPath(
      `${SystemConstants.API_PATH.PLUGINS.BASE}${RouteConstants.SEGMENTS.PLUGINS_INSTALL_OPERATION}`,
      { operationId },
    );
    const deadline = Date.now() + PluginMarketplaceInstall.TIMEOUT_MS;
    let said = '';
    while (Date.now() < deadline) {
      const { operation } = await this.api.get<{ operation?: Record<string, any> }>(path);
      if (!operation) throw new Error(`Install operation ${operationId} is no longer known to the platform.`);
      const line = [operation.phase, operation.message].filter(Boolean).join(': ');
      if (line && line !== said) onStatus((said = line));
      if (operation.status === 'completed') return operation;
      if (operation.status === 'failed') throw new Error(String(operation.error || operation.message || 'The install failed.'));
      await this.wait(PluginMarketplaceInstall.POLL_INTERVAL_MS);
    }
    throw new Error(`Install operation ${operationId} did not finish within ${PluginMarketplaceInstall.TIMEOUT_MS / 60000} minutes; its state is in the admin.`);
  }
}
