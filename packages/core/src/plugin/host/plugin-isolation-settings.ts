import { CoercionUtils } from '@core/utils/coercion-utils';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The operator's isolation LIMITS — declared platform settings (Settings → Infrastructure →
 * Plugin Isolation), read once when a host starts, never invented in code beyond the mirrored
 * defaults in `SystemConstants` that the admin shows as the placeholder.
 *
 * WHERE a plugin runs is no longer a setting. Every plugin runs in its own process: inside the api a
 * plugin holds the api itself — every secret, every site's data, the whole schema — so a "shared" mode
 * made one bad plugin a platform compromise. Only the framework's OWN bundled extensions keep the
 * choice their manifest states, since they are the framework. A manifest's `sandbox: { memoryLimit,
 * timeout }` still overrides the platform limits for that plugin.
 */
export class PluginIsolationSettings {
  private constructor(
    readonly memoryMb: number,
    readonly timeoutMs: number,
  ) {}

  static async read(db: { findOne(table: string, where: Record<string, unknown>): Promise<any> }): Promise<PluginIsolationSettings> {
    const value = async (key: string) => CoercionUtils.toString((await db.findOne(SystemConstants.TABLE.META, { key }))?.value).trim();
    const memory = CoercionUtils.toNumber(await value(SystemConstants.META_KEY.PLUGIN_ISOLATION_MEMORY_MB));
    const timeout = CoercionUtils.toNumber(await value(SystemConstants.META_KEY.PLUGIN_ISOLATION_TIMEOUT_MS));
    return new PluginIsolationSettings(
      memory > 0 ? memory : SystemConstants.PLUGIN_ISOLATION_MEMORY_MB_DEFAULT,
      timeout > 0 ? timeout : SystemConstants.PLUGIN_ISOLATION_TIMEOUT_MS_DEFAULT,
    );
  }

  static defaults(): PluginIsolationSettings {
    return new PluginIsolationSettings(SystemConstants.PLUGIN_ISOLATION_MEMORY_MB_DEFAULT, SystemConstants.PLUGIN_ISOLATION_TIMEOUT_MS_DEFAULT);
  }

  /** Effective limits for one plugin: its manifest's `sandbox` object wins over the platform values. */
  forPlugin(sandbox: unknown): { memoryMb: number; timeoutMs: number } {
    const declared = sandbox && typeof sandbox === 'object' ? (sandbox as { memoryLimit?: unknown; timeout?: unknown }) : {};
    const memory = CoercionUtils.toNumber(declared.memoryLimit);
    const timeout = CoercionUtils.toNumber(declared.timeout);
    return { memoryMb: memory > 0 ? memory : this.memoryMb, timeoutMs: timeout > 0 ? timeout : this.timeoutMs };
  }

  /** Whether a plugin runs isolated: always, unless it is one of the framework's own bundled extensions. */
  isIsolated(sandbox: unknown, bundled = false): boolean {
    if (!bundled) return true;
    if (sandbox === false) return false;
    if (sandbox && typeof sandbox === 'object' && (sandbox as { enabled?: unknown }).enabled === false) return false;
    return true;
  }
}
