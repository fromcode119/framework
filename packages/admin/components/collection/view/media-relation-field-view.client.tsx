import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { MediaPicker } from '@/components/media/view/media-picker.client';
import { MediaRelationFieldUtils } from '@/components/collection/media-relation-field-utils';
import { MediaRelationFileRow } from '@/components/collection/view/media-relation-file-row.client';
import type { IMediaRelationPreview } from '@/components/collection/interfaces/media-relation-preview.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A media field. One file: an image shows as a picture, anything else as a named file — a PDF handed to
 * `<img>` rendered as a broken image. Several files: one row per file, each removable, and picking ADDS a
 * file (it used to replace the lot, so a "many files" field could hold only one).
 */
export class MediaRelationFieldView extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare hasMany: boolean;
  @prop declare wholeImage: boolean;
  @prop declare open: boolean;
  @prop declare previews: IMediaRelationPreview[];
  @prop declare selectedIds: Array<string | number>;
  @prop declare onOpenChange: (open: boolean) => void;
  @prop declare onSelect: (item: any) => void;
  @prop declare onRemove: (id: string) => void;

  @bound private handleOpen(): void {
    this.onOpenChange(true);
  }

  @bound private handleClose(): void {
    this.onOpenChange(false);
  }

  @bound private handlePick(item: any): void {
    this.onSelect(item);
    this.onOpenChange(false);
  }

  @bound private handleRemoveSingle(): void {
    const id = this.previews[0]?.id ?? this.selectedIds[0];
    if (id !== undefined) this.onRemove(String(id));
  }

  private get singleImage(): IMediaRelationPreview | null {
    const preview = this.previews[0];
    return !this.hasMany && preview?.url && MediaRelationFieldUtils.mimeTypeOf(preview).startsWith('image/') ? preview : null;
  }

  private renderEmpty(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <div className={`px-3.5 h-10 flex items-center rounded-[var(--radius)] text-xs font-semibold ${dark ? 'bg-slate-900/30 text-slate-500 border border-dashed border-slate-800' : 'bg-slate-50 text-slate-400 border border-dashed border-slate-200'}`}>
        {AdminI18n.t('ui.media.none')}
      </div>
    );
  }

  private renderSingleImage(preview: IMediaRelationPreview): ReactNode {
    const label = AdminI18n.t('ui.media.remove', { name: preview.filename || '' });
    return (
      <div className="relative w-full aspect-video rounded-[var(--radius)] overflow-hidden border border-slate-200 dark:border-slate-800">
        <img src={preview.url} alt={preview.filename || AdminI18n.t('ui.media.selected')} className={`w-full h-full ${this.wholeImage ? 'object-contain p-3' : 'object-cover'}`} />
        <button type="button" onClick={this.handleRemoveSingle} aria-label={label} title={label}
          className="absolute top-2 right-2 w-8 h-8 inline-flex items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/90 text-slate-500 hover:text-rose-600 shadow">
          <FrameworkIcons.X size={14} />
        </button>
      </div>
    );
  }

  private renderSelection(): ReactNode {
    const image = this.singleImage;
    if (image) return this.renderSingleImage(image);
    if (this.previews.length) {
      return <div className="space-y-2">{this.previews.map((preview) => <MediaRelationFileRow key={String(preview.id)} preview={preview} onRemove={this.onRemove} />)}</div>;
    }
    if (!this.selectedIds.length) return this.renderEmpty();
    // Selected, but no file could be resolved for it (deleted, or unreadable): say which id is stored.
    const many = this.hasMany && this.selectedIds.length > 1;
    return (
      <div className="px-3.5 h-10 flex items-center rounded-[var(--radius)] text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-900/50 dark:text-slate-200 dark:border-slate-800">
        {AdminI18n.t(many ? 'ui.media.selectedIds' : 'ui.media.selectedId', { ids: this.selectedIds.join(', ') })}
      </div>
    );
  }

  render(): ReactNode {
    return (
      <div className="space-y-3">
        {this.renderSelection()}
        <button
          type="button"
          onClick={this.handleOpen}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-[var(--radius)] bg-indigo-600 text-white text-[11px] font-semibold tracking-wide shadow-sm hover:shadow-md active:scale-[0.99] transition-all"
        >
          {this.hasMany ? <FrameworkIcons.Plus size={14} /> : <FrameworkIcons.Image size={14} />}
          {AdminI18n.t(this.hasMany ? 'ui.media.add' : 'ui.media.select')}
        </button>
        {this.open ? <MediaPicker onSelect={this.handlePick} onClose={this.handleClose} /> : null}
      </div>
    );
  }
}
