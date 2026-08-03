import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';

/**
 * Turns an API-JSON plugin row back into one whose enum fields are real {@link PluginState} /
 * {@link PluginRegistryHealth} / {@link PluginHeldReason} members.
 *
 * **Why this exists.** `ILoadedPlugin` types those three fields as enums, but the value that crosses
 * the wire is a plain string (the members serialise via `toJSON`). A consumer that compares
 * `plugin.state === PluginState.ACTIVE` on an un-hydrated row is comparing an object to a string —
 * always false, and it type-checks. Hydrating ONCE at each fetch boundary keeps every downstream
 * comparison correct without sprinkling `resolve()` through ~20 call sites.
 */
export class LoadedPluginHydration {
  /** One row. Non-objects pass through untouched so a null/undefined response stays null/undefined. */
  static one<T>(row: T): T {
    if (!row || typeof row !== 'object') return row;
    const plugin = row as unknown as ILoadedPlugin;
    return {
      ...plugin,
      state: PluginState.resolve(plugin.state),
      healthStatus: PluginRegistryHealth.resolve(plugin.healthStatus),
      heldReason: PluginHeldReason.resolve(plugin.heldReason),
    } as unknown as T;
  }

  /** A list; a non-array response becomes an empty array, matching what the callers already did. */
  static many<T>(rows: T[] | unknown): T[] {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => LoadedPluginHydration.one(row as T));
  }
}
