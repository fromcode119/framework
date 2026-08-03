export interface IMediaWebPConversionResult {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: 'image/webp';
  originalSize: number;
  convertedSize: number;
}
