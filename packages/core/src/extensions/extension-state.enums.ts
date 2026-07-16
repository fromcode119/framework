// ─── Companion enums file for the core-extension lifecycle state ─────────────

/**
 * A core extension's lifecycle state, held in-memory on `LoadedCoreExtension.state`.
 *
 * Distinct from `PluginState` (`_system_plugins.state`): plugins express the operator's
 * INTENT to run, persisted in the database, whereas a core extension is a package inside
 * the monorepo whose state tracks how far it has progressed through discovery → load →
 * activation at runtime. The two value sets overlap (`active`, `error`) but are NOT
 * interchangeable — never assign a `PluginState` to a core extension or vice versa.
 */
export enum ExtensionState {
  DISCOVERED = 'discovered',
  LOADED = 'loaded',
  ACTIVE = 'active',
  DISABLED = 'disabled',
  ERROR = 'error',
}
