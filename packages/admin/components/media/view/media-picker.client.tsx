import type { IMediaItem } from '@/components/media/interfaces/media-item.interface';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Reactor, prop, state, bound, watch } from '@fromcode119/reactor';
import { CoercionUtils } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { RootFramework } from '@fromcode119/react';
import { MediaPickerSourceService } from '@/components/media/media-picker-source-service';
import { MediaPickerHeader } from '@/components/media/view/media-picker-header.client';
import { MediaPickerToolbar } from '@/components/media/view/media-picker-toolbar.client';
import { MediaPickerGrid } from '@/components/media/view/media-picker-grid.client';
import { MediaPickerDetails } from '@/components/media/view/media-picker-details.client';

export class MediaPicker extends Reactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<MediaPicker, 'onSelect' | 'onClose' | 'allowMultiple' | 'value' | 'allowThemeAssets'>;

  @prop declare onSelect: (item: IMediaItem) => void;
  @prop declare onClose: () => void;
  @prop declare allowMultiple?: boolean;
  /** What the field currently holds, so the picker opens ON that asset instead of on nothing. */
  @prop declare value?: string;
  /**
   * Opt-in second source: the images and videos that ship inside the active theme. Off by default
   * because a field storing a media RECORD ID has nothing to point at for a theme asset — there is
   * no media row behind it. Fields that store a path or a URL turn it on.
   */
  @prop declare allowThemeAssets?: boolean;

  @state items: IMediaItem[] = [];
  @state themeItems: IMediaItem[] = [];
  @state loading = true;
  @state themeLoading = false;
  @state uploading = false;
  @state search = '';
  @state selectedId: string | null = null;
  @state mounted = false;
  @state themeSource = false;

  componentDidMount(): void {
    this.mounted = true;
    void this.loadSources();
  }

  /**
   * Both fetchers RETURN what they loaded and the selection reads those arrays, never `this.items` /
   * `this.themeItems`: after mount a `@state` write goes through `setState`, so the accessor still
   * reads the PREVIOUS value on the very next line. The first version selected against an empty list
   * and silently opened on nothing, with the asset sitting right there in the grid.
   */
  @bound private async loadSources(): Promise<void> {
    const [uploads, themeAssets] = await Promise.all([this.fetchMedia(), this.fetchThemeAssets()]);
    this.selectCurrentValue(uploads, themeAssets);
  }

  @bound async fetchMedia(): Promise<IMediaItem[]> {
    this.loading = true;
    let loaded: IMediaItem[] = [];
    try {
      const query = this.search ? `?q=${encodeURIComponent(this.search)}` : '';
      const result = await AdminApi.get(`${AdminConstants.ENDPOINTS.MEDIA.BASE}${query}`);
      loaded = Array.isArray(result) ? result : result.docs || [];
      this.items = loaded;
    } catch (error) {
      console.error('Failed to fetch media:', error);
    } finally {
      this.loading = false;
    }
    return loaded;
  }

  @bound private async fetchThemeAssets(): Promise<IMediaItem[]> {
    if (!this.allowThemeAssets) return [];
    this.themeLoading = true;
    let loaded: IMediaItem[] = [];
    try {
      loaded = await MediaPickerSourceService.fetchThemeAssets();
      this.themeItems = loaded;
    } catch (error) {
      console.error('Failed to fetch theme assets:', error);
    } finally {
      this.themeLoading = false;
    }
    return loaded;
  }

  /** Opens on the asset the field already holds — on the tab it actually lives in. */
  private selectCurrentValue(uploads: IMediaItem[], themeAssets: IMediaItem[]): void {
    const match = MediaPickerSourceService.resolveSelection(CoercionUtils.toString(this.value), themeAssets, uploads);
    if (!match) return;
    this.selectedId = match.id;
    this.themeSource = !!match.relativePath;
  }

  private get visibleItems(): IMediaItem[] {
    if (!this.themeSource) return this.items;
    return MediaPickerSourceService.search(this.themeItems, this.search);
  }

  private get visibleLoading(): boolean {
    return this.themeSource ? this.themeLoading : this.loading;
  }

  private get emptyMessage(): string {
    return this.themeSource ? 'No assets ship with this theme' : 'No media found';
  }

  private get selectedItem(): IMediaItem | null {
    return this.items.concat(this.themeItems).find((item) => item.id === this.selectedId) || null;
  }

  @watch('search') onSearchChanged(): void {
    if (this.themeSource) return;
    void this.fetchMedia();
  }

  @bound private handleSearchChange(value: string): void {
    this.search = value;
  }

  @bound private handleSourceChange(themeSource: boolean): void {
    this.themeSource = themeSource;
  }

  @bound private handleTileSelect(item: IMediaItem): void {
    this.selectedId = item.id;
  }

  @bound private handleConfirm(item: IMediaItem): void {
    this.onSelect(item);
    this.onClose();
  }

  @bound async handleUpload(file: File): Promise<void> {
    this.uploading = true;
    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await AdminApi.upload(`${AdminConstants.ENDPOINTS.MEDIA.UPLOAD}`, formData);

      // Refresh list and select the new item
      await this.fetchMedia();
      if (result.id || result.doc?.id) {
        const newItem = result.doc || result;
        this.selectedId = newItem.id;
        this.handleConfirm(newItem);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      this.uploading = false;
    }
  }

  render(): ReactNode {
    if (!this.mounted) return null;

    return createPortal(
    <RootFramework>
      <div className="fixed inset-0 z-[2147483000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[80vh] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
          <MediaPickerHeader
            showSourceTabs={!!this.allowThemeAssets}
            themeSource={this.themeSource}
            onSourceChange={this.handleSourceChange}
            onClose={this.onClose}
          />
          <MediaPickerToolbar
            search={this.search}
            onSearchChange={this.handleSearchChange}
            uploading={this.uploading}
            canUpload={!this.themeSource}
            onFile={this.handleUpload}
          />
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-transparent">
              <MediaPickerGrid
                items={this.visibleItems}
                loading={this.visibleLoading}
                emptyMessage={this.emptyMessage}
                selectedId={this.selectedId}
                onSelect={this.handleTileSelect}
                onConfirm={this.handleConfirm}
              />
            </div>
            <div className="w-80 border-l border-slate-100 dark:border-slate-800 p-6 bg-white dark:bg-slate-900 flex flex-col">
              <MediaPickerDetails item={this.selectedItem} onConfirm={this.handleConfirm} />
            </div>
          </div>
        </div>
      </div>
    </RootFramework>,
    document.body
    );
  }
}
