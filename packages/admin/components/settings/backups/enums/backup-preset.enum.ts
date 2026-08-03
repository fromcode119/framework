import { Enum } from '@fromcode119/reactor';

/** One-click section presets on the create-backup card. */
export class BackupPreset extends Enum {
  static readonly FULL = new BackupPreset('full');
  static readonly CORE_DB = new BackupPreset('core-db');
  static readonly PLUGINS_ONLY = new BackupPreset('plugins-only');
  static readonly THEMES_ONLY = new BackupPreset('themes-only');

  private constructor(value: string) {
    super(value);
  }
}
