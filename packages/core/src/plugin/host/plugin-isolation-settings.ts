import { CoercionUtils } from '@core/utils/coercion-utils';
import { SystemConstants } from '@core/constants/system.constants';
import type { IGuestResourceLimits } from '@core/process/interfaces/guest-resource-limits.interface';

/**
 * The operator's isolation LIMITS — declared platform settings (Settings → Infrastructure →
 * Plugin Isolation), read once when a host starts, never invented in code beyond the mirrored
 * defaults in `SystemConstants` that the admin shows as the placeholder.
 *
 * WHERE a plugin runs is no longer a setting. Every plugin runs in its own process: inside the api a
 * plugin holds the api itself — every secret, every site's data, the whole schema — so a "shared" mode
 * made one bad plugin a platform compromise. Only the framework's OWN bundled extensions keep the
 * choice their manifest states, since they are the framework. A manifest's `sandbox: { memoryLimit,
 * timeout }` still overrides the platform limits for that plugin — except that a plugin a SITE
 * uploaded may only lower them: its manifest is the uploader's to write.
 *
 * A site's plugin is also held to a share of the machine (`siteResourceLimits`): its CPU, its whole
 * resident memory, what it keeps on disk and how many processes it runs — none of which the heap
 * ceiling and the deadline bound.
 */
export class PluginIsolationSettings {
  private constructor(
    readonly memoryMb: number,
    readonly timeoutMs: number,
    readonly siteCpuPercent: number = SystemConstants.PLUGIN_ISOLATION_SITE_CPU_PERCENT_DEFAULT,
    readonly siteMemoryMb: number = SystemConstants.PLUGIN_ISOLATION_SITE_MEMORY_MB_DEFAULT,
    readonly siteDiskMb: number = SystemConstants.PLUGIN_ISOLATION_SITE_DISK_MB_DEFAULT,
    readonly siteMaxTasks: number = SystemConstants.PLUGIN_ISOLATION_SITE_MAX_TASKS_DEFAULT,
  ) {}

  static async read(db: { findOne(table: string, where: Record<string, unknown>): Promise<any> }): Promise<PluginIsolationSettings> {
    const value = async (key: string) => CoercionUtils.toNumber(CoercionUtils.toString((await db.findOne(SystemConstants.TABLE.META, { key }))?.value).trim());
    const memory = await value(SystemConstants.META_KEY.PLUGIN_ISOLATION_MEMORY_MB);
    const timeout = await value(SystemConstants.META_KEY.PLUGIN_ISOLATION_TIMEOUT_MS);
    const siteCpu = await value(SystemConstants.META_KEY.PLUGIN_ISOLATION_SITE_CPU_PERCENT);
    const siteMemory = await value(SystemConstants.META_KEY.PLUGIN_ISOLATION_SITE_MEMORY_MB);
    const siteDisk = await value(SystemConstants.META_KEY.PLUGIN_ISOLATION_SITE_DISK_MB);
    const siteTasks = await value(SystemConstants.META_KEY.PLUGIN_ISOLATION_SITE_MAX_TASKS);
    return new PluginIsolationSettings(
      memory > 0 ? memory : SystemConstants.PLUGIN_ISOLATION_MEMORY_MB_DEFAULT,
      timeout > 0 ? timeout : SystemConstants.PLUGIN_ISOLATION_TIMEOUT_MS_DEFAULT,
      siteCpu > 0 ? siteCpu : SystemConstants.PLUGIN_ISOLATION_SITE_CPU_PERCENT_DEFAULT,
      siteMemory > 0 ? siteMemory : SystemConstants.PLUGIN_ISOLATION_SITE_MEMORY_MB_DEFAULT,
      siteDisk > 0 ? siteDisk : SystemConstants.PLUGIN_ISOLATION_SITE_DISK_MB_DEFAULT,
      siteTasks > 0 ? siteTasks : SystemConstants.PLUGIN_ISOLATION_SITE_MAX_TASKS_DEFAULT,
    );
  }

  static defaults(): PluginIsolationSettings {
    return new PluginIsolationSettings(SystemConstants.PLUGIN_ISOLATION_MEMORY_MB_DEFAULT, SystemConstants.PLUGIN_ISOLATION_TIMEOUT_MS_DEFAULT);
  }

  /**
   * Effective limits for one plugin: its manifest's `sandbox` object wins over the platform values —
   * for a site's plugin only where it asks for LESS.
   */
  forPlugin(sandbox: unknown, siteOwned = false): { memoryMb: number; timeoutMs: number } {
    const declared = sandbox && typeof sandbox === 'object' ? (sandbox as { memoryLimit?: unknown; timeout?: unknown }) : {};
    const memory = CoercionUtils.toNumber(declared.memoryLimit);
    const timeout = CoercionUtils.toNumber(declared.timeout);
    const pick = (asked: number, platform: number) => (asked > 0 && (!siteOwned || asked < platform) ? asked : platform);
    return { memoryMb: pick(memory, this.memoryMb), timeoutMs: pick(timeout, this.timeoutMs) };
  }

  /** What a plugin a site uploaded may hold of the shared machine; a platform plugin is not held to it. */
  siteResourceLimits(): IGuestResourceLimits {
    return { cpuPercent: this.siteCpuPercent, memoryMb: this.siteMemoryMb, diskMb: this.siteDiskMb, maxTasks: this.siteMaxTasks };
  }

  /** Whether a plugin runs isolated: always, unless it is one of the framework's own bundled extensions. */
  isIsolated(sandbox: unknown, bundled = false): boolean {
    if (!bundled) return true;
    if (sandbox === false) return false;
    if (sandbox && typeof sandbox === 'object' && (sandbox as { enabled?: unknown }).enabled === false) return false;
    return true;
  }
}
