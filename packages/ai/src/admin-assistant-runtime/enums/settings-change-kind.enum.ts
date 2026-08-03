import { Enum } from '@fromcode119/reactor';

/** What kind of change a turn requests. */
export class SettingsChangeKind extends Enum {
  static readonly NONE = new SettingsChangeKind('none');
  static readonly CREATE = new SettingsChangeKind('create');
  static readonly UPDATE = new SettingsChangeKind('update');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to NONE. */
  static resolve(value: unknown): SettingsChangeKind {
    if (value instanceof SettingsChangeKind) return value;
    const found = SettingsChangeKind.fromValue(String(value ?? '').trim());
    return (found as SettingsChangeKind | undefined) ?? SettingsChangeKind.NONE;
  }
}
