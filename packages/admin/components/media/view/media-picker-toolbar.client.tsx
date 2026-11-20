import { SearchField } from '@/components/ui/view/search-field.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ChangeEvent, ReactNode } from 'react';
import { Reactor, prop, bound, ref } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { PageBar } from '@/components/ui/view/page-bar.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Search on the left, upload on the right — the library's own bar — with the hidden file input it drives. */
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

  @bound private openFilePicker(): void {
    this.fileInputRef.current?.click();
  }

  @bound private handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file) this.onFile(file);
    event.target.value = '';
  }

  render(): ReactNode {
    return (
      <PageBar lead={<SearchField placeholder={AdminI18n.t('mediaPicker.searchMedia')} value={this.search} onChange={this.onSearchChange} />}>
        {this.filterLabel ? <Badge variant={BadgeVariant.GRAY}>{AdminI18n.t('mediaPicker.showingOnly', { types: this.filterLabel })}</Badge> : null}
        <input type="file" ref={this.fileInputRef} hidden onChange={this.handleFileChange} accept={this.uploadAccept} />
        {this.canUpload ? (
          <Button variant={ButtonVariant.SECONDARY} onClick={this.openFilePicker} isLoading={this.uploading} disabled={this.uploading}>
            <FrameworkIcons.Upload size={14} />
            {AdminI18n.t('mediaPicker.uploadNew')}
          </Button>
        ) : null}
      </PageBar>
    );
  }
}
