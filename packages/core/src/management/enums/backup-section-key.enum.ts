import { Enum } from '@fromcode119/reactor';

/**
 * A selectable section of a system backup. The `.value` is the on-disk directory name and the wire
 * value sent by the admin, so persist/transmit `.value` and hydrate incoming strings with `resolve`.
 */
export class BackupSectionKey extends Enum {
  static readonly CORE = new BackupSectionKey('core');
  static readonly DATABASE = new BackupSectionKey('database');
  static readonly PLUGINS = new BackupSectionKey('plugins');
  static readonly THEMES = new BackupSectionKey('themes');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire string to a member, or `undefined` when it is not a known section. */
  static resolve(value: unknown): BackupSectionKey | undefined {
    return BackupSectionKey.fromValue(String(value ?? '').trim().toLowerCase()) as BackupSectionKey | undefined;
  }
}
