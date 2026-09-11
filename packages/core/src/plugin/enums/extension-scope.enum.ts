import { Enum } from '@fromcode119/react-class-components';

/** Which extension area an operation targets (plugin, theme, appearance, or the framework core). */
export class ExtensionScope extends Enum {
  static readonly PLUGIN = new ExtensionScope('plugin');
  static readonly THEME = new ExtensionScope('theme');
  static readonly APPEARANCE = new ExtensionScope('appearance');
  static readonly CORE = new ExtensionScope('core');

  private constructor(value: string) {
    super(value);
  }

  /**
   * The member a raw wire string names, or null when it names none.
   *
   * Use this wherever the answer decides what gets WRITTEN to disk. `appearance` was missing from
   * this enum while Sources passed its build type straight through, so `resolve()` fell to its
   * default and every appearance auto-update installed itself as a plugin — into the plugins root,
   * under the plugin validator, with no error anywhere.
   */
  static find(value: unknown): ExtensionScope | null {
    if (value instanceof ExtensionScope) return value;
    return (ExtensionScope.fromValue(String(value ?? '').trim().toLowerCase()) as ExtensionScope | undefined) ?? null;
  }

  /**
   * Resolve a raw wire/plugin string to a member, defaulting to PLUGIN.
   *
   * The default is only safe where "plugin" is genuinely the subject and an unrecognised value is a
   * typo in a label. Anything that places files must use `find` and refuse what it cannot name.
   */
  static resolve(value: unknown): ExtensionScope {
    return ExtensionScope.find(value) ?? ExtensionScope.PLUGIN;
  }
}
