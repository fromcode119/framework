import { ThemeMode } from '@fromcode119/core/client';
import { MediaPickerSourceService } from '@/components/media/media-picker-source-service';
import type React from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { MediaRelationFieldUtils } from '@/components/collection/media-relation-field-utils';
import { MediaRelationFieldView } from '@/components/collection/view/media-relation-field-view.client';
import type { IMediaRelationPreview } from '@/components/collection/interfaces/media-relation-preview.interface';

export class MediaRelationField extends Reactor {
  @prop declare value: any;
  @prop declare onChange: (val: any) => void;
  @prop declare theme: ThemeMode;
  @prop declare hasMany?: boolean;
  /** Show the whole picked image instead of filling the box — a logo must not be cropped. */
  @prop declare wholeImage?: boolean;

  @state open = false;
  @state preview: IMediaRelationPreview | null = null;

  private hydrateToken = 0;

  private getSelectedIds(): Array<string | number> {
    return MediaRelationFieldUtils.getSelectedIds(this.value);
  }

  @bound private async hydratePreview(): Promise<void> {
    const token = ++this.hydrateToken;
    const isCurrent = () => token === this.hydrateToken;
    const selectedIds = this.getSelectedIds();
    const preview = this.preview;

    const firstId = selectedIds[0];
    if (!firstId) {
      if (isCurrent()) this.preview = null;
      return;
    }

    const currentPreviewId = String(preview?.filename || '').startsWith('media-')
      ? String(preview?.filename || '').replace(/^media-/, '')
      : '';
    if (preview?.url && currentPreviewId === String(firstId)) {
      return;
    }

    // A theme-asset selection ("theme:<relativePath>") is not a media record — resolve its preview
    // from the active theme's asset listing instead of the media collection.
    if (String(firstId).startsWith('theme:')) {
      const themeAssets = await MediaPickerSourceService.fetchThemeAssets();
      if (!isCurrent()) return;
      const match = themeAssets.find((item) => item.id === String(firstId));
      this.preview = match ? { url: match.url, filename: match.filename } : null;
      return;
    }

    // The media API, not the generic collection record: only it addresses the file on the SITE's host.
    // A site's uploads live in its own directory and are served per host, so a bare `path` resolved
    // against the console's host 404s for every file uploaded since sites got their own directories.
    try {
      const response = await AdminApi.get(`${AdminConstants.ENDPOINTS.MEDIA.BASE}?id=${encodeURIComponent(String(firstId))}&limit=1`);
      if (!isCurrent()) return;
      const docs = Array.isArray(response) ? response : Array.isArray(response?.docs) ? response.docs : [];
      const doc = docs[0];
      const url = doc?.url ? MediaRelationFieldUtils.resolvePreviewUrl(String(doc.url)) : '';
      this.preview = url ? { url, filename: String(doc.filename || doc.originalName || `media-${firstId}`) } : null;
    } catch {
      if (isCurrent()) this.preview = null;
    }
  }

  componentDidMount(): void {
    void this.hydratePreview();
  }

  componentDidUpdate(prevProps: { value: any }): void {
    if (prevProps.value !== this.value) void this.hydratePreview();
  }

  componentWillUnmount(): void {
    // Invalidate any in-flight hydrate so it can't setState after unmount.
    this.hydrateToken++;
  }

  @bound private handleSelect(item: any): void {
    const hasMany = this.hasMany ?? false;
    const selectedId = item?.id || item?._id || item;
    if (hasMany) {
      this.onChange(selectedId ? [selectedId] : []);
    } else {
      this.onChange(selectedId);
    }
    this.preview = { url: item.url, filename: item.filename };
  }

  @bound private handleOpenChange(v: boolean): void {
    this.open = v;
  }

  render(): React.ReactNode {
    const hasMany = this.hasMany ?? false;

    return (
      <MediaRelationFieldView
        wholeImage={Boolean(this.wholeImage)}
        theme={this.theme}
        hasMany={hasMany}
        open={this.open}
        preview={this.preview}
        selectedIds={this.getSelectedIds()}
        onOpenChange={this.handleOpenChange}
        onSelect={this.handleSelect}
      />
    );
  }
}
