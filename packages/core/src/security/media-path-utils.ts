import path from 'path';
import { SystemConstants } from '../constants';

/**
 * Framework-owned safety for resolving a public uploads reference to a disk path.
 * Plugins must NOT hand-roll uploads-prefix stripping + `..`/`\0` traversal checks
 * — they call this so the security lives in ONE framework place and uses real
 * directory-confinement (resolve + prefix check), not a fragile substring test.
 */
export class MediaPathUtils {
  /** The public mount prefix every upload URL/path starts with (with a trailing slash),
   *  sourced from the canonical storage constant — never a re-hardcoded literal. */
  static readonly UPLOADS_PREFIX = `${String(SystemConstants.STORAGE.DEFAULT_PUBLIC_URL || '/uploads').replace(/\/+$/, '')}/`;

  /**
   * Resolve a public upload reference (a `/uploads/...` path OR a full
   * `http(s)://host/uploads/...` URL) to an absolute disk path INSIDE `uploadDir`.
   * Returns `null` if the input is not an uploads path or escapes `uploadDir`.
   */
  static resolveSafeUploadDiskPath(uploadDir: string, src: unknown): string | null {
    const pathname = MediaPathUtils.toUploadPathname(src);
    if (!pathname || pathname.includes('\0')) return null;
    if (!pathname.startsWith(MediaPathUtils.UPLOADS_PREFIX)) return null;

    const rel = pathname.slice(MediaPathUtils.UPLOADS_PREFIX.length);
    const root = path.resolve(String(uploadDir || ''));
    const resolved = path.resolve(root, rel);
    // Real confinement: the resolved path must be the root itself or live beneath it.
    if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
    return resolved;
  }

  /** Reduce a full upload URL to its pathname; pass through an already-relative path. */
  private static toUploadPathname(src: unknown): string {
    const s = String(src ?? '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) {
      try { return new URL(s).pathname; } catch { return ''; }
    }
    return s;
  }
}
