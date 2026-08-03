import { Enum } from '@fromcode119/reactor';

/**
 * A theme's activation state, persisted in `_system_themes.state`.
 *
 * Exactly one theme row is `ACTIVE` at a time; activating a theme flips the previously active row to
 * `INACTIVE`. Distinct from `PluginState` (`_system_plugins.state`) and from `ExtensionState` (core
 * extensions) — the value sets overlap but are not interchangeable.
 *
 * A reactor `Enum`, so the column value is `.value`. That matters most in a WHERE clause: passing the
 * MEMBER to `findOne({ state })` would match no row and the storefront would render with no theme.
 */
export class ThemeState extends Enum {
  static readonly ACTIVE = new ThemeState('active');
  static readonly INACTIVE = new ThemeState('inactive');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a persisted/raw value to a member; anything unknown is INACTIVE. */
  static resolve(value: unknown): ThemeState {
    if (value instanceof ThemeState) return value;
    const found = ThemeState.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as ThemeState | undefined) ?? ThemeState.INACTIVE;
  }
}
