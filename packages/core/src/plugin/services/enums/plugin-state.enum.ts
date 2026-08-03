import { Enum } from '@fromcode119/reactor';

/**
 * A plugin's activation state — the operator's INTENT for whether it runs. Orthogonal to
 * `PluginRegistryHealth` (how it's actually doing). Persisted in `_system_plugins.state`.
 *
 * A reactor `Enum`: members are singletons, so `state === PluginState.ACTIVE` is an identity check.
 * The persisted column holds the STRING, so every DB read goes through `PluginState.resolve(row.state)`
 * and every DB write through `.value` — comparing a member to a raw string is always false.
 */
export class PluginState extends Enum {
  static readonly INACTIVE = new PluginState('inactive');
  static readonly LOADING = new PluginState('loading');
  static readonly ACTIVE = new PluginState('active');
  static readonly ERROR = new PluginState('error');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a persisted/raw value to a member; anything unknown is INACTIVE (does not run). */
  static resolve(value: unknown): PluginState {
    if (value instanceof PluginState) return value;
    const found = PluginState.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as PluginState | undefined) ?? PluginState.INACTIVE;
  }
}
