import { BackupPreset } from '@/components/settings/backups/enums/backup-preset.enum';
import { BackupSectionKey } from '@fromcode119/core';
import type { ChangeEvent, DragEvent } from 'react';
import { prop, state, ref, bound } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import type { ISystemBackupCapabilities } from '@/components/settings/backups/interfaces/system-backup-capabilities.interface';
import type { IBackupProgressView } from '@/components/settings/backups/interfaces/backup-progress-view.interface';

/**
 * Taking a backup archive from the operator — by file picker or by dropping it on the card.
 *
 * The base of this card's chain. Both routes end in the same handler, so a dropped archive and a
 * picked one are validated identically; a drop that is not an archive is refused with a stated reason
 * rather than started and failed halfway.
 *
 * The drag counter matters: `dragleave` fires when the pointer crosses a CHILD element too, so a
 * naive handler clears the highlight while the pointer is still over the card.
 */
export abstract class BackupCreateCardDropZone extends AdminComponent {
  protected static readonly BACKUP_IMPORT_ACCEPT = '.tar.gz,.gz,application/gzip,application/x-gzip,.sql,.db';
  @prop declare capabilities: ISystemBackupCapabilities;
  @prop declare createSections: BackupSectionKey[];
  @prop declare isCreating: boolean;
  @prop declare isImporting: boolean;
  @prop declare createProgress: IBackupProgressView | null;
  @prop declare importProgress: IBackupProgressView | null;
  @prop declare onToggleSection: (value: BackupSectionKey) => void;
  @prop declare onApplyPreset: (value: BackupPreset) => void;
  @prop declare onCreate: () => Promise<void>;
  @prop declare onImport: (file: File) => Promise<void>;

  @ref declare fileInputRef: Ref<HTMLInputElement>;

  @state isDropActive = false;
  @state importError = '';

  protected handleImportFile(file: File | null): void {
    if (!file) {
      return;
    }

    const normalizedName = String(file.name || '').trim().toLowerCase();
    const isSupportedArchive = normalizedName.endsWith('.tar.gz') || normalizedName.endsWith('.sql') || normalizedName.endsWith('.db');
    if (!isSupportedArchive) {
      this.importError = 'Choose a .tar.gz, .sql, or .db backup archive.';
      return;
    }

    this.importError = '';
    void this.onImport(file);
  }

  @bound protected handleUploadClick(): void {
    if (!this.capabilities.canManage || this.isCreating || this.isImporting) {
      return;
    }

    this.fileInputRef.current?.click();
  }

  @bound protected handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = '';
    this.handleImportFile(file || null);
  }

  @bound protected handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (!this.capabilities.canManage || this.isCreating || this.isImporting) {
      return;
    }

    this.isDropActive = true;
  }

  @bound protected handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      this.isDropActive = false;
    }
  }

  @bound protected handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    this.isDropActive = false;
    if (!this.capabilities.canManage || this.isCreating || this.isImporting) {
      return;
    }

    this.handleImportFile(event.dataTransfer.files?.[0] || null);
  }
}
