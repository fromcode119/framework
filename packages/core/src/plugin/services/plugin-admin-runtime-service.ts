import { Logger } from '@core/logging';
import { SystemConstants } from '@core/constants/system.constants';
import type { ICollection } from '@core/interfaces/collection.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IAdminSecondaryPanelAllowlistEntry } from '@core/plugin/services/interfaces/admin-secondary-panel-allowlist-entry.interface';
import { AdminMetadataService } from '@core/plugin/services/admin-metadata-service';
import { LifecycleService } from '@core/plugin/services/lifecycle-service';
import { RuntimeService } from '@core/plugin/services/runtime-service';
import { SecurityMonitor } from '@core/security/security-monitor';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

export class PluginAdminRuntimeService {
  constructor(
    private readonly logger: Logger,
    private readonly db: any,
    private readonly admin: AdminMetadataService,
    private readonly lifecycle: LifecycleService,
    private readonly runtime: RuntimeService,
    private readonly security: SecurityMonitor,
    private readonly plugins: Map<string, ILoadedPlugin>,
    private readonly registeredCollections: Map<string, { collection: ICollection; pluginSlug: string }>,
  ) {}

  async getSecuritySummary(): Promise<any> {
    const all = Array.from(this.plugins.values());
    const active = all.filter((plugin) => plugin.state === PluginState.ACTIVE);
    const isSandboxed = (plugin: ILoadedPlugin) => plugin.manifest?.sandbox !== false;
    const mismatch = active.filter(isSandboxed).filter((plugin) => !plugin.isSandboxed);
    const sandbox = await this.lifecycle.getSandboxStats();
    const memoryUsage = process.memoryUsage();

    return {
      sandbox,
      hostMemory: {
        rssBytes: memoryUsage.rss,
        heapTotalBytes: memoryUsage.heapTotal,
        heapUsedBytes: memoryUsage.heapUsed,
        externalBytes: memoryUsage.external,
        arrayBuffersBytes: memoryUsage.arrayBuffers || 0,
        dbNetworkBuffersEstimateBytes: memoryUsage.arrayBuffers || 0,
        otherNonIsolateAllocationsEstimateBytes: Math.max(0, memoryUsage.rss - Number(sandbox?.heap?.used_heap_size || 0)),
      },
      monitor: await this.security.getSecurityStats(),
      pluginIsolation: {
        totalPlugins: all.length,
        activePlugins: active.length,
        sandboxConfiguredPlugins: all.filter(isSandboxed).length,
        sandboxActivePlugins: active.filter(isSandboxed).length,
        sandboxRuntimeActivePlugins: active.filter((plugin) => !!plugin.isSandboxed).length,
        sandboxPolicyRuntimeMismatchPlugins: mismatch.length,
        sandboxPolicyRuntimeMismatchSlugs: mismatch.map((plugin) => plugin.manifest.slug),
        unsandboxedActivePlugins: active.filter((plugin) => !isSandboxed(plugin)).length,
        unsandboxedActivePluginSlugs: active.filter((plugin) => !isSandboxed(plugin)).map((plugin) => plugin.manifest.slug),
      },
      integrityEnforced: true,
      signatureEnforced: !!process.env.REQUIRE_SIGNATURES,
    };
  }

  getRuntimeModules(): Record<string, any> {
    return this.runtime.getModules(Array.from(this.plugins.values()).filter((plugin) => plugin.state === PluginState.ACTIVE));
  }

  async getAdminMetadata(getSortedPlugins: () => ILoadedPlugin[]): Promise<any> {
    const allowlistEntries = await this.getSecondaryPanelAllowlistEntries();
    return this.admin.getAdminMetadata(
      getSortedPlugins(),
      this.registeredCollections,
      this.getRuntimeModules(),
      allowlistEntries,
    );
  }

  getImportMap(): { imports: Record<string, string> } {
    const modules = this.getRuntimeModules();
    const imports: Record<string, string> = {};

    Object.entries(modules).forEach(([name, mod]: [string, any]) => {
      if (mod.url) {
        imports[name] = mod.url;
      } else if (mod.source) {
        imports[name] = `data:text/javascript;base64,${mod.source}`;
      }
    });

    return { imports };
  }

  private async getSecondaryPanelAllowlistEntries(): Promise<IAdminSecondaryPanelAllowlistEntry[]> {
    try {
      const records = await this.db.find(SystemConstants.TABLE.META);
      const row = (records || []).find((entry: any) => String(entry?.key || '') === 'admin.secondaryPanel.allowlist.v1');
      if (!row || row.value === null || row.value === undefined) {
        return [];
      }

      const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      this.logger.warn(`[secondary-panel] Failed to load allowlist: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}