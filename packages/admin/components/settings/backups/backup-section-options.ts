import { BackupPreset } from '@/components/settings/backups/enums/backup-preset.enum';
import { BackupSectionKey, BackupCatalogGroupKey, BackupCatalogRootKind } from '@fromcode119/core';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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
        label: AdminI18n.t('settings.components.coreFiles'),
        description: AdminI18n.t('settings.components.packagesConfigsScriptsDocsTests'),
        helper: AdminI18n.t('settings.components.useThisForCodeAnd'),
      },
      {
        key: BackupSectionKey.DATABASE,
        label: AdminI18n.t('settings.components.database'),
        description: AdminI18n.t('settings.components.aPostgresqlDumpOrSqlite'),
        helper: AdminI18n.t('settings.components.useThisWhenYouNeed'),
      },
      {
        key: BackupSectionKey.PLUGINS,
        label: AdminI18n.t('settings.components.plugins'),
        description: AdminI18n.t('settings.components.theFullPluginsDirectoryIncluding'),
        helper: AdminI18n.t('settings.components.useThisWhenPluginCode'),
      },
      {
        key: BackupSectionKey.THEMES,
        label: AdminI18n.t('settings.components.themes'),
        description: AdminI18n.t('settings.components.theFullThemesDirectoryIncluding'),
        helper: AdminI18n.t('settings.components.useThisWhenFrontendPresentation'),
      },
    ];
  }

  static describeSections(sections: BackupSectionKey[]): string {
    if (!sections.length) return AdminI18n.t('settings.components.nothingSelected');
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
    if (section === BackupSectionKey.CORE) return AdminI18n.t('settings.components.coreFiles');
    if (section === BackupSectionKey.DATABASE) return AdminI18n.t('settings.components.database');
    if (section === BackupSectionKey.PLUGINS) return AdminI18n.t('settings.components.plugins');
    if (section === BackupSectionKey.THEMES) return AdminI18n.t('settings.components.themes');
    return String(value ?? '');
  }

  private static getSectionSortIndex(value: BackupSectionKey): number {
    return (BackupSectionKey.values() as BackupSectionKey[]).indexOf(value);
  }
}
