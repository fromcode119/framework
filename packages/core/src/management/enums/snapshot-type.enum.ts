import { Enum } from '@fromcode119/reactor';

/** Which kind of snapshot a restore targets. */
export class SnapshotType extends Enum {
  static readonly SYSTEM = new SnapshotType('system');
  static readonly PLUGINS = new SnapshotType('plugins');
  static readonly THEMES = new SnapshotType('themes');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire string to a member; defaults to SYSTEM. */
  static resolve(value: unknown): SnapshotType {
    if (value instanceof SnapshotType) return value;
    const found = SnapshotType.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as SnapshotType | undefined) ?? SnapshotType.SYSTEM;
  }
}
