import type { IMediaItem } from '@/components/media/interfaces/media-item.interface';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound, watch } from '@fromcode119/react-class-components';
import { CoercionUtils } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons } from '@fromcode119/react';
import { MediaPickerSourceService } from '@/components/media/media-picker-source-service';
import { MediaPickerToolbar } from '@/components/media/view/media-picker-toolbar.client';
import { MediaPickerTile } from '@/components/media/view/media-picker-tile.client';
import { FocusModal } from '@/components/ui/view/focus-modal.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { Loader } from '@/components/ui/view/loader.client';
import { Hint } from '@/components/ui/view/hint.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { MediaAcceptFilter } from '@/components/media/media-accept-filter';

export class MediaPicker extends Reactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<MediaPicker, 'onSelect' | 'onClose' | 'allowMultiple' | 'value' | 'allowThemeAssets' | 'accept'>;

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
  /** The field's `admin.accept` (`image/*`, …): only those files are listed and offered for upload. */
  @prop declare accept?: string;

  @state items: IMediaItem[] = [];
  @state themeItems: IMediaItem[] = [];
  @state loading = true;
  @state themeLoading = false;
  @state uploading = false;
  @state search = '';
  @state selectedId: string | null = null;
  @state mounted = false;
  @state themeSource = false;
  @state uploadFailed = false;

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
      const params = new URLSearchParams();
      if (this.search) params.set('q', this.search);
      if (this.filter.active) params.set('accept', this.filter.query);
      const query = params.toString() ? `?${params.toString()}` : '';
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
    // Theme assets are part of the ONE media popup everywhere; a caller opts OUT explicitly.
    if (this.allowThemeAssets === false) return [];
    this.themeLoading = true;
    let loaded: IMediaItem[] = [];
    try {
      loaded = (await MediaPickerSourceService.fetchThemeAssets()).filter((item) => this.filter.matches(item));
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

  private get filter(): MediaAcceptFilter {
    return MediaAcceptFilter.from(this.accept);
  }

  private get visibleItems(): IMediaItem[] {
    if (!this.themeSource) return this.items;
    return MediaPickerSourceService.search(this.themeItems, this.search);
  }

  private get visibleLoading(): boolean {
    return this.themeSource ? this.themeLoading : this.loading;
  }

  private get emptyMessage(): string {
    return this.themeSource ? AdminI18n.t('mediaPicker.noAssetsShipWithThis') : AdminI18n.t('mediaPicker.noMediaFound');
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

  @bound private handleSourceChange(tab: string): void {
    this.themeSource = tab === 'theme';
  }

  @bound private insertSelected(): void {
    if (this.selectedItem) this.handleConfirm(this.selectedItem);
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
    this.uploadFailed = false;
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
      this.uploadFailed = true;
    } finally {
      this.uploading = false;
    }
  }

  private get tabs(): { id: string; label: string }[] {
    if (this.allowThemeAssets === false) return [];
    return [
      { id: 'uploads', label: AdminI18n.t('mediaPicker.uploads') },
      { id: 'theme', label: AdminI18n.t('mediaPicker.theme') },
    ];
  }

  private renderFiles(): ReactNode {
    if (this.visibleLoading) return <Loader />;
    if (!this.visibleItems.length) return <EmptyState icon={<FrameworkIcons.Image size={20} />} title={this.emptyMessage} />;
    return (
      <div className="fc-tile-grid">
        {this.visibleItems.map((item) => (
          <MediaPickerTile key={item.id} item={item} selected={this.selectedId === item.id} onSelect={this.handleTileSelect} onConfirm={this.handleConfirm} />
        ))}
      </div>
    );
  }

  /**
   * The window-sized dialog of the kit, not a panel of its own: the files need the room, and the
   * choice is confirmed from its foot, where the chosen file's name stands beside the button.
   */
  render(): ReactNode {
    if (!this.mounted) return null;
    return (
      <FocusModal
        isOpen
        wide
        label={AdminI18n.t('mediaPicker.mediaLibrary')}
        tabs={this.tabs}
        activeTab={this.themeSource ? 'theme' : 'uploads'}
        onTab={this.handleSourceChange}
        onClose={this.onClose}
        onConfirm={this.insertSelected}
        confirmLabel={AdminI18n.t('mediaPicker.insertAsset')}
        confirmDisabled={!this.selectedItem}
        footNote={this.selectedItem ? this.selectedItem.originalName || this.selectedItem.filename : undefined}
      >
        <MediaPickerToolbar
          search={this.search}
          onSearchChange={this.handleSearchChange}
          uploading={this.uploading}
          canUpload={!this.themeSource}
          onFile={this.handleUpload}
          uploadAccept={this.filter.uploadAccept}
          filterLabel={this.filter.active ? this.filter.label : ''}
        />
        {this.uploadFailed ? <Hint variant="error">{AdminI18n.t('mediaPicker.uploadFailedPleaseTryAgain')}</Hint> : null}
        {this.renderFiles()}
      </FocusModal>
    );
  }
}
