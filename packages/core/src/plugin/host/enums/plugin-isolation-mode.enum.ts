import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * WHERE plugin code runs, as the operator chose it in Settings → Infrastructure.
 *
 * `ISOLATED` is each active plugin in its own process — no access to the platform's secrets, every
 * database call bound to the request's site, a memory ceiling and a per-request deadline. `SHARED` is
 * inside the api process, as it was before isolation existed. A plugin whose manifest declares
 * `sandbox: false` stays shared whichever of these is set.
 */
export class PluginIsolationMode extends Enum {
  /** Its own process, with nothing of the platform's in it. */
  static readonly ISOLATED = new PluginIsolationMode('isolated');

  /** Inside the api process. */
  static readonly SHARED = new PluginIsolationMode('shared');

  private constructor(value: string) {
    super(value);
  }

  /** The member a stored setting names; anything unrecognised is ISOLATED, the safe default. */
  static resolve(value: unknown): PluginIsolationMode {
    if (value instanceof PluginIsolationMode) return value;
    return (PluginIsolationMode.fromValue(String(value ?? '').trim().toLowerCase()) as PluginIsolationMode | undefined)
      ?? PluginIsolationMode.ISOLATED;
  }
}
