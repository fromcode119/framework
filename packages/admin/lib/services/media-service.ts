import { BaseService } from './base-service';
import { AdminApi } from '../api';

/**
 * Service for media file handling and URL resolution.
 * 
 * Handles:
 * - Media URL resolution
 * - URL validation
 * - Image optimization paths
 */
export class MediaService extends BaseService {
  /**
   * Resolves a media value (string) into a full URL if needed.
   * 
   * - Already full URLs (http/https) pass through
   * - Data URLs and blob URLs pass through
   * - Relative paths get resolved via API base URL
   * 
   * @example
   * resolveMediaUrl('/uploads/image.jpg') // "http://api.local/uploads/image.jpg"
   * resolveMediaUrl('https://cdn.com/image.jpg') // "https://cdn.com/image.jpg"
   * resolveMediaUrl('data:image/png;base64,...') // "data:image/png;base64,..."
   */
  resolveMediaUrl(value: any): string {
    const raw = String(value || '').trim();
    if (!raw) return '';

    // Already absolute or special protocol
    if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
      return raw;
    }

    // Resolve relative path via API
    return AdminApi.getURL(raw.startsWith('/') ? raw : `/${raw}`);
  }

  /**
   * Check if a URL points to an image.
   * 
   * @example
   * isImageUrl('/image.jpg') // true
   * isImageUrl('/document.pdf') // false
   */
  isImageUrl(url: string): boolean {
    if (!url) return false;
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i;
    return imageExtensions.test(url);
  }

  /**
   * Check if a URL points to a video.
   * 
   * @example
   * isVideoUrl('/video.mp4') // true
   * isVideoUrl('/image.jpg') // false
   */
  isVideoUrl(url: string): boolean {
    if (!url) return false;
    const videoExtensions = /\.(mp4|webm|ogg|mov|avi|mkv)$/i;
    return videoExtensions.test(url);
  }

  /**
   * Get file extension from URL or filename.
   * 
   * @example
   * getExtension('/image.jpg') // "jpg"
   * getExtension('document.pdf') // "pdf"
   * getExtension('noext') // ""
   */
  getExtension(url: string): string {
    if (!url) return '';
    const match = url.match(/\.([^./?#]+)(?:[?#]|$)/);
    return match ? match[1].toLowerCase() : '';
  }

  /**
   * Generate optimized image URL with transformations.
   * 
   * @example
   * optimizeImage('/image.jpg', { width: 800, quality: 80 })
   * // "/image.jpg?w=800&q=80"
   */
  optimizeImage(
    url: string,
    options: { width?: number; height?: number; quality?: number; format?: string } = {}
  ): string {
    if (!url) return '';

    const params = new URLSearchParams();
    if (options.width) params.set('w', String(options.width));
    if (options.height) params.set('h', String(options.height));
    if (options.quality) params.set('q', String(options.quality));
    if (options.format) params.set('f', options.format);

    const queryString = params.toString();
    if (!queryString) return url;

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${queryString}`;
  }

  /**
   * Generate thumbnail URL for media file.
   * 
   * @example
   * getThumbnailUrl('/uploads/image.jpg') // "/uploads/image.jpg?w=200&h=200"
   */
  getThumbnailUrl(url: string, size: number = 200): string {
    return this.optimizeImage(url, { width: size, height: size });
  }
}