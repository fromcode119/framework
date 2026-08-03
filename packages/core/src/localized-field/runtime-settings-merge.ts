import { RuntimeRegistryAccess } from '@core/runtime-registry-access';
import { EnvUtils } from '@core/utils/env-utils';

/**
 * Public settings overlaid on whatever the runtime bridge already holds.
 *
 * On the server there is no bridge, so the passed settings are returned as-is. In the browser the
 * bridge may already carry settings pushed by the host (admin or storefront); the explicitly passed
 * record wins on conflict.
 */
export class RuntimeSettingsMerge {
  static apply(publicSettings: Record<string, unknown> | null): Record<string, unknown> | null {
    if (EnvUtils.isServer()) return publicSettings;
    const bridge = RuntimeRegistryAccess.ensure()[RuntimeRegistryAccess.KEYS.REACT_BRIDGE] as
      { getState?: () => { settings?: Record<string, unknown> }; settings?: Record<string, unknown> } | undefined;
    const runtimeSettings = bridge?.getState?.()?.settings || bridge?.settings;
    if (!publicSettings && !runtimeSettings) return null;
    return { ...(runtimeSettings || {}), ...(publicSettings || {}) };
  }
}
