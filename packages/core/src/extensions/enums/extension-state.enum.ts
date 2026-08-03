import { Enum } from '@fromcode119/reactor';

/**
 * A core extension's lifecycle state, held in-memory on `LoadedCoreExtension.state`.
 *
 * Distinct from `PluginState` (`_system_plugins.state`): plugins express the operator's INTENT to run,
 * persisted in the database, whereas a core extension is a package inside the monorepo whose state
 * tracks how far it has progressed through discovery → load → activation at runtime. The two value sets
 * overlap (`active`, `error`) but are NOT interchangeable — never assign a `PluginState` to a core
 * extension or vice versa. Being singletons of different classes, a reactor `Enum` now makes that
 * mistake a type error rather than a value that merely compares equal.
 */
export class ExtensionState extends Enum {
  static readonly DISCOVERED = new ExtensionState('discovered');
  static readonly LOADED = new ExtensionState('loaded');
  static readonly ACTIVE = new ExtensionState('active');
  static readonly DISABLED = new ExtensionState('disabled');
  static readonly ERROR = new ExtensionState('error');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw value to a member; anything unknown is DISCOVERED (not yet loaded). */
  static resolve(value: unknown): ExtensionState {
    if (value instanceof ExtensionState) return value;
    const found = ExtensionState.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as ExtensionState | undefined) ?? ExtensionState.DISCOVERED;
  }
}
