import type { IPluginCoreCompatibility } from '@core/plugin/services/runtime/interfaces/plugin-core-compatibility.interface';

/**
 * Thrown when an install or update is refused because the running core does not satisfy the plugin's
 * `manifest.engines.core`. Carries the versions so a caller can report the exact mismatch, and a stable
 * `code` so an auto-updater can tell "needs a newer core" apart from an ordinary install failure.
 */
export class PluginCoreIncompatibleError extends Error {
  readonly code = 'CORE_TOO_OLD';

  constructor(
    readonly slug: string,
    readonly compatibility: IPluginCoreCompatibility,
    message: string,
  ) {
    super(message);
    this.name = 'PluginCoreIncompatibleError';
  }
}
