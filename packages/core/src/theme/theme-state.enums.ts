// ─── Companion enums file for the theme activation state ─────────────────────

/**
 * A theme's activation state, persisted in `_system_themes.state`.
 *
 * Exactly one theme row is `ACTIVE` at a time; activating a theme flips the previously
 * active row to `INACTIVE`. Distinct from `PluginState` (`_system_plugins.state`) and from
 * `ExtensionState` (core extensions) — the value sets overlap but are not interchangeable.
 */
export enum ThemeState {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
