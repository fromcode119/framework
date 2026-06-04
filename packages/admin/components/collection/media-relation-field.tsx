"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { MediaPicker } from '@/components/media/media-picker';
import { AdminApi } from '@/lib/api';
import { AdminServices } from '@/lib/admin-services';
import { AdminConstants } from '@/lib/constants';

function resolvePreviewUrl(pathOrUrl: string): string {
  return AdminServices.getInstance().media.resolveMediaUrl(pathOrUrl);
}

interface MediaRelationFieldProps {
  value: any;
  onChange: (val: any) => void;
  theme: string;
  hasMany?: boolean;
}

interface MediaRelationFieldState {
  open: boolean;
  preview: { url?: string; filename?: string } | null;
}

export class MediaRelationField extends React.Component<MediaRelationFieldProps, MediaRelationFieldState> {
  state: MediaRelationFieldState = { open: false, preview: null };
  private hydrateToken = 0;

  private getSelectedIds(): Array<string | number> {
    const { value } = this.props;
    const normalizeEntry = (entry: any): any => {
      if (entry && typeof entry === 'object') {
        return entry.id ?? entry._id ?? entry.value;
      }
      return entry;
    };

    const normalizeScalarOrListString = (entry: any): Array<string | number> => {
      const text = String(entry ?? '').trim();
      if (!text) return [];
      if (text.startsWith('[') && text.endsWith(']')) {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            return parsed
              .map((item) => normalizeEntry(item))
              .filter((item) => item !== null && item !== undefined && String(item).trim().length > 0);
          }
        } catch {
          // Keep as scalar when parsing fails.
        }
      }
      return [entry];
    };

    if (Array.isArray(value)) {
      return value
        .flatMap((entry) => normalizeScalarOrListString(normalizeEntry(entry)))
        .filter((entry) => entry !== null && entry !== undefined && String(entry).trim().length > 0);
    }

    if (value && typeof value === 'object') {
      const objectId = value.id ?? value._id ?? value.value;
      return normalizeScalarOrListString(objectId);
    }

    return normalizeScalarOrListString(value);
  }

  private getSelectedKey(): string {
    return this.getSelectedIds().map((entry) => String(entry)).join('|');
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
      const resolvedUrl = resolvePreviewUrl(pathOrUrl);

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
          const resolvedUrl = resolvePreviewUrl(fallbackPath);
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
    const setOpen = (v: boolean) => this.setState({ open: v });
    const selectedIds = this.getSelectedIds();
    const selectedLabel = hasMany ? selectedIds.join(', ') : String(selectedIds[0] || '');

    return (
    <div className="space-y-3">
      {preview?.url ? (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
          <img src={preview.url} alt={preview.filename || 'Selected media'} className="w-full h-full object-cover" />
        </div>
      ) : selectedIds.length > 0 ? (
        <div className={`px-3.5 h-10 flex items-center rounded-lg text-xs font-semibold ${theme === 'dark' ? 'bg-slate-900/50 text-slate-200 border border-slate-800' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
          Selected media ID{hasMany && selectedIds.length > 1 ? 's' : ''}: {selectedLabel}
        </div>
      ) : (
        <div className={`px-3.5 h-10 flex items-center rounded-lg text-xs font-semibold ${theme === 'dark' ? 'bg-slate-900/30 text-slate-500 border border-dashed border-slate-800' : 'bg-slate-50 text-slate-400 border border-dashed border-slate-200'}`}>
          No media selected
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold tracking-wide shadow-sm hover:shadow-md active:scale-[0.99] transition-all"
      >
        <FrameworkIcons.Image size={14} />
        Select Media
      </button>

      {open && (
        <MediaPicker
          onSelect={(item) => {
            this.handleSelect(item);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
    );
  }
}
