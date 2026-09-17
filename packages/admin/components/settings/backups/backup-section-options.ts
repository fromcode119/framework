import { BackupPreset } from '@/components/settings/backups/enums/backup-preset.enum';
import { BackupSectionKey, BackupCatalogGroupKey, BackupCatalogRootKind } from '@fromcode119/core';

/**
 * Which parts of a deployment a backup covers, and how those choices are presented.
 *
 * Sections are a CHOICE the operator makes, not a fixed set: a preset picks a starting point, and
 * toggling one off has to keep the rest intact. The order is fixed by an explicit sort index rather
 * than by however the options happen to be listed, so the dialog does not reshuffle as presets change.
 *
 * Split out of `SystemBackupPageUtils` (345 lines), which holds the catalogue and restore-dialog
 * shapes.
 */
export class BackupSectionOptions {
  static createDefaultSections(): BackupSectionKey[] {
    return BackupSectionKey.values() as BackupSectionKey[];
  }

  static applyCreatePreset(value: BackupPreset): BackupSectionKey[] {
    if (value === BackupPreset.CORE_DB) return [BackupSectionKey.CORE, BackupSectionKey.DATABASE];
    if (value === BackupPreset.PLUGINS_ONLY) return [BackupSectionKey.PLUGINS];
    if (value === BackupPreset.THEMES_ONLY) return [BackupSectionKey.THEMES];
    return this.createDefaultSections();
  }

  static toggleSection(
    sections: BackupSectionKey[],
    value: BackupSectionKey,
  ): BackupSectionKey[] {
    return sections.includes(value)
      ? sections.filter((section) => section !== value)
      : [...sections, value].sort((left, right) => BackupSectionOptions.getSectionSortIndex(left) - BackupSectionOptions.getSectionSortIndex(right));
  }

  static getSectionOptions(): Array<{
    key: BackupSectionKey;
    label: string;
    description: string;
    helper: string;
  }> {
    return [
      {
        key: BackupSectionKey.CORE,
        label: 'Core Files',
        description: 'Packages, configs, scripts, docs, tests, and the rest of the framework workspace.',
        helper: 'Use this for code and system configuration rollback.',
      },
      {
        key: BackupSectionKey.DATABASE,
        label: 'Database',
        description: 'A PostgreSQL dump or SQLite copy when the active environment supports it.',
        helper: 'Use this when you need content and settings state.',
      },
      {
        key: BackupSectionKey.PLUGINS,
        label: 'Plugins',
        description: 'The full plugins directory, including installed plugin code and assets.',
        helper: 'Use this when plugin code changed or needs migration.',
      },
      {
        key: BackupSectionKey.THEMES,
        label: 'Themes',
        description: 'The full themes directory, including custom theme source and built assets.',
        helper: 'Use this when frontend presentation changed.',
      },
    ];
  }

  static describeSections(sections: BackupSectionKey[]): string {
    if (!sections.length) return 'nothing selected';
    return sections.map((section) => this.getSectionLabel(section)).join(', ');
  }

  /**
   * `includedSections` arrives from the API, where `Enum.toJSON()` has already flattened each member
   * to its plain string — so a bare `value === BackupSectionKey.CORE` is comparing a string to an
   * object and is ALWAYS false. Every section then fell through to 'Themes' in the
   * "Backup Created" toast. Hydrate first, exactly as the enum's own doc instructs.
   */
  static getSectionLabel(value: BackupSectionKey | string): string {
    const section = BackupSectionKey.resolve(value);
    if (section === BackupSectionKey.CORE) return 'Core Files';
    if (section === BackupSectionKey.DATABASE) return 'Database';
    if (section === BackupSectionKey.PLUGINS) return 'Plugins';
    if (section === BackupSectionKey.THEMES) return 'Themes';
    return String(value ?? '');
  }

  private static getSectionSortIndex(value: BackupSectionKey): number {
    return (BackupSectionKey.values() as BackupSectionKey[]).indexOf(value);
  }
}
