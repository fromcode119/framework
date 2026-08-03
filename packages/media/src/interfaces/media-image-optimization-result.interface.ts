export interface IMediaImageOptimizationResult {
  buffer: Buffer;
  width?: number;
  height?: number;
  mimeType: string;
  optimized: boolean;
}
