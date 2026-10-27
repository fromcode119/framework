import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ChangeEvent, ReactNode } from 'react';
import { Reactor, prop, bound, ref } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { Search, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/view/button.client';
import { AdminTypography } from '@/lib/typography';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Search box plus the upload control, including the hidden file input it drives. */
export class MediaPickerToolbar extends Reactor {
  @prop declare search: string;
  @prop declare onSearchChange: (value: string) => void;
  @prop declare uploading: boolean;
  /** Off while a source that cannot receive uploads is showing. */
  @prop declare canUpload: boolean;
  @prop declare onFile: (file: File) => void;
  /** What the file input offers: the field's own types, or every format the library stores. */
  @prop declare uploadAccept: string;
  /** The types the list is narrowed to, stated so a short list is never mistaken for the whole library. */
  @prop declare filterLabel: string;

  @ref declare fileInputRef: Ref<HTMLInputElement>;

  @bound private handleSearchChange(event: ChangeEvent<HTMLInputElement>): void {
    this.onSearchChange(event.target.value);
  }

  @bound private openFilePicker(): void {
    this.fileInputRef.current?.click();
  }

  @bound private handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file) this.onFile(file);
  }

  render(): ReactNode {
    const { search, uploading, canUpload, uploadAccept, filterLabel } = this;

    return (
      <div className="px-4 py-3 md:px-8 md:py-4 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 md:gap-4">
        <div className="relative flex-1 min-w-[12rem] group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
          <input
            type="text"
            placeholder={AdminI18n.t('mediaPicker.searchMedia')}
            value={search}
            onChange={this.handleSearchChange}
            className={`w-full h-10 pl-10 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${AdminTypography.TYPOGRAPHY.LABEL}`}
          />
        </div>
        <input
          type="file"
          ref={this.fileInputRef}
          className="hidden"
          onChange={this.handleFileChange}
          accept={uploadAccept}
        />
        {filterLabel ? (
          <span className={`shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 ${AdminTypography.TYPOGRAPHY.LABEL}`}>
            {AdminI18n.t('mediaPicker.showingOnly', { types: filterLabel })}
          </span>
        ) : null}
        <Button
          variant={ButtonVariant.PRIMARY}
          onClick={this.openFilePicker}
          disabled={uploading || !canUpload}
        >
          {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
          {AdminI18n.t('mediaPicker.uploadNew')}
        </Button>
      </div>
    );
  }
}
