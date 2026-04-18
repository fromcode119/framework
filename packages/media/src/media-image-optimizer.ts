import path from 'path';
import sharp from 'sharp';
import type {
  MediaImageOptimizationOptions,
  MediaImageOptimizationResult,
} from './media-image-optimizer.interfaces';

export class MediaImageOptimizer {
  private static readonly IMAGE_MIME_BY_EXT: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };

  private static readonly DEFAULT_OPTIONS: Required<MediaImageOptimizationOptions> = {
    maxWidth: 1600,
    maxHeight: 1600,
    withoutEnlargement: true,
    jpegQuality: 82,
    pngCompressionLevel: 9,
    webpQuality: 82,
  };

  static supports(filename: string): boolean {
    return Boolean(this.resolveSupportedExtension(filename));
  }

  static async optimizeBuffer(
    file: Buffer,
    filename: string,
    options: MediaImageOptimizationOptions = {},
  ): Promise<MediaImageOptimizationResult> {
    const ext = this.resolveSupportedExtension(filename);
    const mimeType = this.resolveMimeType(filename);
    if (!ext) {
      return {
        buffer: file,
        mimeType,
        optimized: false,
      };
    }

    const settings = { ...this.DEFAULT_OPTIONS, ...(options || {}) };
    const originalMetadata = await sharp(file, { animated: false }).metadata();
    const pipeline = sharp(file, { animated: false }).rotate();
    pipeline.resize(settings.maxWidth, settings.maxHeight, {
      fit: 'inside',
      withoutEnlargement: settings.withoutEnlargement,
    });

    if (ext === '.jpg' || ext === '.jpeg') {
      pipeline.jpeg({
        quality: settings.jpegQuality,
        mozjpeg: true,
        progressive: true,
      });
    } else if (ext === '.png') {
      pipeline.png({
        compressionLevel: settings.pngCompressionLevel,
        adaptiveFiltering: true,
        effort: 8,
      });
    } else if (ext === '.webp') {
      pipeline.webp({
        quality: settings.webpQuality,
        effort: 6,
      });
    }

    const optimized = await pipeline.toBuffer({ resolveWithObject: true });
    const nextBuffer = optimized.data.length < file.length ? optimized.data : file;
    const usingOptimizedBuffer = nextBuffer !== file;

    return {
      buffer: nextBuffer,
      width: usingOptimizedBuffer ? optimized.info.width : originalMetadata.width,
      height: usingOptimizedBuffer ? optimized.info.height : originalMetadata.height,
      mimeType,
      optimized: usingOptimizedBuffer,
    };
  }

  private static resolveSupportedExtension(filename: string): string {
    const ext = path.extname(String(filename || '')).toLowerCase();
    return this.IMAGE_MIME_BY_EXT[ext] ? ext : '';
  }

  private static resolveMimeType(filename: string): string {
    const ext = path.extname(String(filename || '')).toLowerCase();
    return this.IMAGE_MIME_BY_EXT[ext] || 'application/octet-stream';
  }
}
