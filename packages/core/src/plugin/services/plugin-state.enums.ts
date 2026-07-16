// ─── Companion enums file for the plugin activation state ────────────────────

/**
 * A plugin's activation state — the operator's INTENT for whether it runs. Orthogonal to
 * `PluginRegistryHealth` (how it's actually doing). Persisted in `_system_plugins.state`.
 */
export enum PluginState {
  INACTIVE = 'inactive',
  LOADING = 'loading',
  ACTIVE = 'active',
  ERROR = 'error',
}
