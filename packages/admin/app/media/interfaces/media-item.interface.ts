

export interface IMediaItem {
  /**
   * Numeric for an uploaded file; `theme:<relativePath>` for one that ships inside the active theme.
   * Theme assets are listed beside uploads because "find that picture" is one job from the operator's
   * seat — but they live in the theme bundle, so nothing may write to them.
   */
  id: number | string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  url: string;
  optimizedUrl?: string | null;
  optimizedSize?: number | null;
  optimizedWidth?: number | null;
  optimizedHeight?: number | null;
  alt?: string | null;
  /** 'public' | 'private' — which storage space holds the bytes. */
  visibility?: string;
  caption?: string | null;
  folderId: number | null;
  /** Set on theme assets: shown, searchable, never deletable / movable / shareable. */
  readOnly?: boolean;
  /** Path inside the theme bundle. Present only on theme assets. */
  relativePath?: string;
  createdAt: string;
}
