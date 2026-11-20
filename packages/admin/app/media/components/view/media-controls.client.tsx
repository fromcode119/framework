import { PageBar } from '@/components/ui/view/page-bar.client';
import { DropArea } from '@/components/ui/view/drop-area.client';
import { Alert } from '@/components/ui/view/alert.client';
import { Tabs } from '@/components/ui/view/tabs.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { SearchField } from '@/components/ui/view/search-field.client';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { ViewMode } from '@/app/media/enums/view-mode.enum';
import type { ReactNode } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { PureReactor, prop, bound, Ref } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { Select } from '@/components/ui/view/select.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IMediaFolder } from '@/app/media/interfaces/media-folder.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Input } from '@/components/ui/view/input.client';

export class MediaControls extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare uploading: boolean;
  @prop declare isDragOver: boolean;
  @prop declare error: string | null;
  @prop declare searchQuery: string;
  @prop declare viewMode: ViewMode;
  @prop declare source: string;
  @prop declare setSource: (value: string) => void;
  @prop declare activeView: string;
  @prop declare setActiveView: (value: string) => void;
  @prop declare fileInputRef: Ref<HTMLInputElement>;
  @prop declare currentFolderId: number | null;
  @prop declare folderPath: IMediaFolder[];
  @prop declare setCurrentFolderId: (id: number | null) => void;
  @prop declare setIsFolderPromptOpen: (value: boolean) => void;
  @prop declare setSearchQuery: (value: string) => void;
  @prop declare setViewMode: (mode: ViewMode) => void;
  @prop declare setError: (value: string | null) => void;
  @prop declare handleDragEnter: (e: DragEvent) => void;
  @prop declare handleDragOver: (e: DragEvent) => void;
  @prop declare handleDragLeave: (e: DragEvent) => void;
  @prop declare handleDrop: (e: DragEvent) => Promise<void>;

  @bound
  protected browseFiles(): void {
    this.fileInputRef.current?.click();
  }

  @bound
  protected dismissError(): void {
    this.setError(null);
  }

  @bound
  protected onSearchChange(e: ChangeEvent<HTMLInputElement>): void {
    this.setSearchQuery(e.target.value);
  }

  @bound
  protected selectGridView(): void {
    this.setViewMode(ViewMode.GRID);
  }

  @bound
  protected selectListView(): void {
    this.setViewMode(ViewMode.LIST);
  }

  render(): ReactNode {
    const { uploading, isDragOver, error, searchQuery, viewMode } = this;

    return (
      <>
        <DropArea
          over={isDragOver}
          onDragEnter={this.handleDragEnter}
          onDragOver={this.handleDragOver}
          onDragLeave={this.handleDragLeave}
          onDrop={this.handleDrop}
          title={isDragOver ? AdminI18n.t('media.dropFilesToUpload') : AdminI18n.t('media.dragFilesHere')}
          hint={AdminI18n.t('media.uploadImagesVideosOrDocuments')}
          // Secondary: the page's one main action is "Upload" in its head. This, the head's and the
          // empty state's were three dark buttons for the same thing.
          action={<Button variant={ButtonVariant.SECONDARY} onClick={this.browseFiles} disabled={uploading}>{uploading ? AdminI18n.t('media.uploading') : AdminI18n.t('media.browseFiles')}</Button>}
        />

        {error ? (
          <Alert tone="danger" action={<Button variant={ButtonVariant.GHOST} size={FieldSize.ICON} aria-label={AdminI18n.t('common.close')} onClick={this.dismissError}><FrameworkIcons.Close size={15} /></Button>}>
            {error}
          </Alert>
        ) : null}

        <PageBar lead={
          <Tabs value={this.activeView} onChange={(key: string) => this.setActiveView(key)}
            tabs={[{ id: 'files', label: AdminI18n.t('media.files') }, { id: 'shares', label: AdminI18n.t('media.shared') }, { id: 'activity', label: AdminI18n.t('media.activity') }]} />
        }>
          {/* Search, the source and the two shapes all act on the list of files; the other views have none of them. */}
          {this.activeView === 'files' ? (
            <>
              <SearchField placeholder={AdminI18n.t('media.searchMedia')} value={searchQuery} onChange={this.setSearchQuery} />
              <div className="fc-page-bar__pick">
                <Select
                  value={this.source}
                  onChange={this.setSource}
                  options={[
                    { value: '', label: AdminI18n.t('media.allFiles') },
                    { value: 'uploads', label: AdminI18n.t('media.uploads') },
                    { value: 'theme', label: AdminI18n.t('media.themeAssets') },
                  ]}
                />
              </div>
              <Tabs value={viewMode === ViewMode.GRID ? 'grid' : 'list'} onChange={(mode: string) => (mode === 'grid' ? this.selectGridView() : this.selectListView())}
                tabs={[{ id: 'grid', label: <FrameworkIcons.Grid size={15} /> }, { id: 'list', label: <FrameworkIcons.List size={15} /> }]} />
            </>
          ) : null}
        </PageBar>
      </>
    );
  }
}
