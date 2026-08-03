import { Enum } from '@fromcode119/reactor';

/** Whether an installable extension archive is a plugin or a theme. */
export class ExtensionKind extends Enum {
  static readonly PLUGIN = new ExtensionKind('plugin');
  static readonly THEME = new ExtensionKind('theme');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire/plugin string to a member; defaults to PLUGIN. */
  static resolve(value: unknown): ExtensionKind {
    if (value instanceof ExtensionKind) return value;
    const found = ExtensionKind.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as ExtensionKind | undefined) ?? ExtensionKind.PLUGIN;
  }
}
