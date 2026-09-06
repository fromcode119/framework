import { CoercionUtils } from '@core/coercion-utils';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The operator's isolation settings — declared platform settings (Settings → Infrastructure →
 * Plugin Isolation), read once when a host starts, never invented in code beyond the mirrored
 * defaults in `SystemConstants` that the admin shows as the placeholder.
 *
 * A plugin's manifest `sandbox: { memoryLimit, timeout }` overrides the platform values for that
 * plugin; `sandbox: false` opts the plugin out of isolation entirely (shown as "shared" in the admin).
 */
export class PluginIsolationSettings {
  private constructor(
    readonly defaultMode: 'isolated' | 'shared',
    readonly memoryMb: number,
    readonly timeoutMs: number,
  ) {}

  static async read(db: { findOne(table: string, where: Record<string, unknown>): Promise<any> }): Promise<PluginIsolationSettings> {
    const value = async (key: string) => CoercionUtils.toString((await db.findOne(SystemConstants.TABLE.META, { key }))?.value).trim();
    const mode = await value(SystemConstants.META_KEY.PLUGIN_ISOLATION_DEFAULT);
    const memory = CoercionUtils.toNumber(await value(SystemConstants.META_KEY.PLUGIN_ISOLATION_MEMORY_MB));
    const timeout = CoercionUtils.toNumber(await value(SystemConstants.META_KEY.PLUGIN_ISOLATION_TIMEOUT_MS));
    return new PluginIsolationSettings(
      mode === 'shared' ? 'shared' : 'isolated',
      memory > 0 ? memory : SystemConstants.PLUGIN_ISOLATION_MEMORY_MB_DEFAULT,
      timeout > 0 ? timeout : SystemConstants.PLUGIN_ISOLATION_TIMEOUT_MS_DEFAULT,
    );
  }

  static defaults(): PluginIsolationSettings {
    return new PluginIsolationSettings('isolated', SystemConstants.PLUGIN_ISOLATION_MEMORY_MB_DEFAULT, SystemConstants.PLUGIN_ISOLATION_TIMEOUT_MS_DEFAULT);
  }

  /** Effective limits for one plugin: its manifest's `sandbox` object wins over the platform values. */
  forPlugin(sandbox: unknown): { memoryMb: number; timeoutMs: number } {
    const declared = sandbox && typeof sandbox === 'object' ? (sandbox as { memoryLimit?: unknown; timeout?: unknown }) : {};
    const memory = CoercionUtils.toNumber(declared.memoryLimit);
    const timeout = CoercionUtils.toNumber(declared.timeout);
    return { memoryMb: memory > 0 ? memory : this.memoryMb, timeoutMs: timeout > 0 ? timeout : this.timeoutMs };
  }

  /** Whether a plugin runs isolated: `sandbox: false` says shared; otherwise the platform default. */
  isIsolated(sandbox: unknown): boolean {
    if (sandbox === false) return false;
    if (sandbox && typeof sandbox === 'object') {
      const enabled = (sandbox as { enabled?: unknown }).enabled;
      if (enabled === false) return false;
      if (enabled === true) return true;
    }
    return this.defaultMode === 'isolated';
  }
}
