export interface IMediaItem {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  filesize: number;
  width?: number;
  height?: number;
  alt?: string;
}
