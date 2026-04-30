export interface MediaImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  withoutEnlargement?: boolean;
  jpegQuality?: number;
  pngCompressionLevel?: number;
  webpQuality?: number;
}

export interface MediaImageOptimizationResult {
  buffer: Buffer;
  width?: number;
  height?: number;
  mimeType: string;
  optimized: boolean;
}

export interface MediaWebPConversionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export interface MediaWebPConversionResult {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: 'image/webp';
  originalSize: number;
  convertedSize: number;
}
