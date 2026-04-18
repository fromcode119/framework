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
