"use client";

import React from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { MediaRelationFieldUtils } from './media-relation-field-utils';
import { MediaRelationFieldView } from './media-relation-field-view';
import type { MediaRelationFieldProps, MediaRelationFieldState } from './media-relation-field.interfaces';

export class MediaRelationField extends React.Component<MediaRelationFieldProps, MediaRelationFieldState> {
  state: MediaRelationFieldState = { open: false, preview: null };
  private hydrateToken = 0;

  private getSelectedIds(): Array<string | number> {
    return MediaRelationFieldUtils.getSelectedIds(this.props.value);
  }

  private hydratePreview = async (): Promise<void> => {
    const token = ++this.hydrateToken;
    const isCurrent = () => token === this.hydrateToken;
    const selectedIds = this.getSelectedIds();
    const preview = this.state.preview;

    const firstId = selectedIds[0];
    if (!firstId) {
      if (isCurrent()) this.setState({ preview: null });
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
        this.setState({ preview: {
          url: resolvedUrl,
          filename: String(response?.filename || response?.originalName || `media-${firstId}`),
        } });
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
          this.setState({ preview: {
            url: resolvedUrl,
            filename: String(matched?.filename || matched?.originalName || `media-${firstId}`),
          } });
          return;
        }
      } catch {
        // Fallback lookup failed; keep textual ID label.
      }

      if (isCurrent()) this.setState({ preview: null });
    }
  };

  componentDidMount(): void {
    void this.hydratePreview();
  }

  componentDidUpdate(prevProps: MediaRelationFieldProps): void {
    if (prevProps.value !== this.props.value) void this.hydratePreview();
  }

  componentWillUnmount(): void {
    // Invalidate any in-flight hydrate so it can't setState after unmount.
    this.hydrateToken++;
  }

  private handleSelect = (item: any): void => {
    const { onChange, hasMany = false } = this.props;
    const selectedId = item?.id || item?._id || item;
    if (hasMany) {
      onChange(selectedId ? [selectedId] : []);
    } else {
      onChange(selectedId);
    }
    this.setState({ preview: { url: item.url, filename: item.filename } });
  };

  render(): React.ReactNode {
    const { theme, hasMany = false } = this.props;
    const { open, preview } = this.state;

    return (
      <MediaRelationFieldView
        theme={theme}
        hasMany={hasMany}
        open={open}
        preview={preview}
        selectedIds={this.getSelectedIds()}
        onOpenChange={(v) => this.setState({ open: v })}
        onSelect={this.handleSelect}
      />
    );
  }
}
