import { ThemeMode } from '@fromcode119/core/client';
import type React from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/reactor';
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

    try {
      const primaryResponse = await AdminApi.get(
        `${AdminConstants.ENDPOINTS.COLLECTIONS.BASE}/media/${encodeURIComponent(String(firstId))}`
      );
      if (!isCurrent()) return;

      const response = primaryResponse?.doc || primaryResponse?.data || primaryResponse;

      const fallbackPathFromFilename = (() => {
        const filename = String(response?.filename || '').trim();
        if (!filename) return '';
        if (filename.startsWith('/')) return filename;
        return `/uploads/${filename}`;
      })();

      const pathOrUrl = String(response?.url || response?.path || fallbackPathFromFilename).trim();
      const resolvedUrl = MediaRelationFieldUtils.resolvePreviewUrl(pathOrUrl);

      if (resolvedUrl) {
        this.preview = {
          url: resolvedUrl,
          filename: String(response?.filename || response?.originalName || `media-${firstId}`),
        };
        return;
      }

      throw new Error('No media url/path returned');
    } catch {
      try {
        const listResponse = await AdminApi.get(`${AdminConstants.ENDPOINTS.MEDIA.BASE}?limit=200`);
        if (!isCurrent()) return;
        const docs = Array.isArray(listResponse)
          ? listResponse
          : Array.isArray(listResponse?.docs)
            ? listResponse.docs
            : [];
        const matched = docs.find((item: any) => String(item?.id ?? item?._id ?? '') === String(firstId));
        const fallbackPath = String(matched?.url || matched?.path || '').trim();
        if (matched && fallbackPath) {
          const resolvedUrl = MediaRelationFieldUtils.resolvePreviewUrl(fallbackPath);
          this.preview = {
            url: resolvedUrl,
            filename: String(matched?.filename || matched?.originalName || `media-${firstId}`),
          };
          return;
        }
      } catch {
        // Fallback lookup failed; keep textual ID label.
      }

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
