import { Enum } from '@fromcode119/reactor';

/** Which extension directory a forge tool targets. */
export class ExtensionArea extends Enum {
  static readonly PLUGINS = new ExtensionArea('plugins');
  static readonly THEMES = new ExtensionArea('themes');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to PLUGINS. */
  static resolve(value: unknown): ExtensionArea {
    if (value instanceof ExtensionArea) return value;
    const found = ExtensionArea.fromValue(String(value ?? '').trim());
    return (found as ExtensionArea | undefined) ?? ExtensionArea.PLUGINS;
  }
}
