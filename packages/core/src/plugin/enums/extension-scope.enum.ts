import { Enum } from '@fromcode119/reactor';

/** Which extension area an operation targets (plugin, theme, or the framework core). */
export class ExtensionScope extends Enum {
  static readonly PLUGIN = new ExtensionScope('plugin');
  static readonly THEME = new ExtensionScope('theme');
  static readonly CORE = new ExtensionScope('core');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire/plugin string to a member; defaults to PLUGIN. */
  static resolve(value: unknown): ExtensionScope {
    if (value instanceof ExtensionScope) return value;
    const found = ExtensionScope.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as ExtensionScope | undefined) ?? ExtensionScope.PLUGIN;
  }
}
