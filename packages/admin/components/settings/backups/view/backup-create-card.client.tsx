import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { BackupPreset } from '@/components/settings/backups/enums/backup-preset.enum';
import { BackupSectionKey } from '@fromcode119/core';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/view/button.client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { ListCard } from '@/components/ui/view/list-card.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { DropArea } from '@/components/ui/view/drop-area.client';
import { Alert } from '@/components/ui/view/alert.client';
import { InlineTip } from '@/components/ui/view/inline-tip.client';
import { ProgressBar } from '@/components/ui/view/progress-bar.client';
import { Text } from '@/components/ui/view/text.client';
import { FrameworkIcons } from '@fromcode119/react';
import { SystemBackupPageUtils } from '@/components/settings/backups/system-backup-page-utils';
import { BackupSectionOptions } from '@/components/settings/backups/backup-section-options';
import { BackupCreateCardDropZone } from '@/components/settings/backups/view/backup-create-card-drop-zone.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Creating a backup, and restoring from one.
 *
 * The top of the chain: the markup. Taking the file lives in `BackupCreateCardDropZone`.
 */
export class BackupCreateCard extends BackupCreateCardDropZone {
  private static icon(key: BackupSectionKey): ReactNode {
    if (key === BackupSectionKey.DATABASE) return <FrameworkIcons.Database size={16} />;
    if (key === BackupSectionKey.PLUGINS) return <FrameworkIcons.Package size={16} />;
    if (key === BackupSectionKey.THEMES) return <FrameworkIcons.Layers size={16} />;
    return <FrameworkIcons.Shield size={16} />;
  }

  render(): ReactNode {
    const { capabilities, createSections, isCreating, isImporting, createProgress, importProgress, onToggleSection, onApplyPreset, onCreate } = this;
    const busy = !capabilities.canManage || isCreating || isImporting;
    const presets: Array<[BackupPreset, string]> = [
      [BackupPreset.FULL, AdminI18n.t('settings.components.fullBackup')],
      [BackupPreset.CORE_DB, AdminI18n.t('settings.components.coreDb')],
      [BackupPreset.PLUGINS_ONLY, AdminI18n.t('settings.components.pluginsOnly')],
      [BackupPreset.THEMES_ONLY, AdminI18n.t('settings.components.themesOnly')],
    ];
    return (
      <RecordCard
        title={AdminI18n.t('settings.components.createBackup')}
        aside={(
          <div className="fc-record-card__table-tools">
            <input ref={this.fileInputRef} type="file" className="hidden" accept={BackupCreateCardDropZone.BACKUP_IMPORT_ACCEPT} onChange={this.handleFileChange} />
            <Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Upload size={15} />} isLoading={isImporting} onClick={this.handleUploadClick} disabled={busy}>
              {isImporting ? AdminI18n.t('settings.components.importingBackup') : AdminI18n.t('settings.components.importBackup')}
            </Button>
            <Button variant={ButtonVariant.PRIMARY} icon={<FrameworkIcons.Plus size={15} />} isLoading={isCreating} onClick={() => void onCreate()} disabled={busy || !createSections.length}>
              {isCreating ? AdminI18n.t('settings.components.creatingBackup') : AdminI18n.t('settings.components.createBackup')}
            </Button>
          </div>
        )}
      >
        <div className="fc-stack">
          <Text muted>{AdminI18n.t('settings.components.pickExactlyWhatGoesInto')}</Text>

          <div className="fc-chip-row fc-chip-row--cell">
            {presets.map(([preset, label]) => <Button key={preset.value} variant={ButtonVariant.SECONDARY} disabled={isCreating} onClick={() => onApplyPreset(preset)}>{label}</Button>)}
          </div>

          {/* What goes into the archive: several of four, so each is a tick. */}
          <ListCard>
            {BackupSectionOptions.getSectionOptions().map((option) => (
              <ListRow key={option.key.value} icon={BackupCreateCard.icon(option.key)} title={option.label} description={option.description} descriptionTitle={option.helper}
                actions={<Checkbox checked={createSections.includes(option.key)} disabled={isCreating} onChange={() => onToggleSection(option.key)} label={createSections.includes(option.key) ? AdminI18n.t('settings.components.included') : AdminI18n.t('settings.components.optional')} />} />
            ))}
          </ListCard>

          <InlineTip label={AdminI18n.t('settings.components.selectedScope')}>
            {BackupSectionOptions.describeSections(createSections)}. {AdminI18n.t('settings.components.systemBackupIsTheArchive')}
          </InlineTip>

          {createProgress ? <ProgressBar value={createProgress.percent} label={createProgress.label} detail={SystemBackupPageUtils.formatProgressPercent(createProgress.percent)} /> : null}

          <DropArea
            title={AdminI18n.t('settings.components.dragAndDropABackup')}
            hint={AdminI18n.t('settings.components.importedArchivesAreIndexedInto')}
            over={this.isDropActive}
            onDragOver={this.handleDragOver}
            onDragLeave={this.handleDragLeave}
            onDrop={this.handleDrop}
            action={<Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Upload size={15} />} isLoading={isImporting} disabled={busy} onClick={this.handleUploadClick}>{isImporting ? AdminI18n.t('settings.components.importing') : AdminI18n.t('settings.components.chooseBackup')}</Button>}
          />
          {this.importError ? <Alert tone="danger">{this.importError}</Alert> : null}
          {importProgress ? <ProgressBar value={importProgress.percent} label={importProgress.label} detail={SystemBackupPageUtils.formatProgressPercent(importProgress.percent)} /> : null}
          <Text size="xsmall" muted>{AdminI18n.t('settings.components.importAcceptsExportedTarGz')}</Text>
        </div>
      </RecordCard>
    );
  }
}
