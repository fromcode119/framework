

export interface IMediaItem {
  id: number;
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
  caption?: string | null;
  folderId: number | null;
  createdAt: string;
}
