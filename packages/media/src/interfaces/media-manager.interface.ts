export interface IMediaManager {
  upload(file: Buffer, filename: string): Promise<{ url: string; path: string; width?: number; height?: number; size: number; mimeType: string }>;
  remove(filepath: string): Promise<void>;
}
