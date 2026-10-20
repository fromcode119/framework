import path from 'path';
import { ApiPathUtils } from '@core/api/api-path-utils';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Framework-owned safety for resolving a public uploads reference to a disk path.
 * Plugins must NOT hand-roll uploads-prefix stripping + `..`/`\0` traversal checks
 * — they call this so the security lives in ONE framework place and uses real
 * directory-confinement (resolve + prefix check), not a fragile substring test.
 */
export class MediaPathUtils {
  /** The public mount prefix every upload URL/path starts with (with a trailing slash),
   *  sourced from the canonical storage constant — never a re-hardcoded literal. */
  static readonly UPLOADS_PREFIX = `${String(SystemConstants.STORAGE.DEFAULT_PUBLIC_URL).replace(/\/+$/, '')}/`;

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

  /**
   * Resolve a theme UI asset reference to an absolute disk path INSIDE `<themesDir>/<slug>/ui`.
   * Returns `null` when the input is not a theme asset reference or escapes that directory.
   *
   * Same real confinement as {@link resolveSafeUploadDiskPath} — resolve, then prefix-check — so a
   * traversal in either the slug or the asset path lands outside the root and is rejected.
   */
  static resolveSafeThemeAssetDiskPath(themesDir: string, src: unknown): string | null {
    const pathname = MediaPathUtils.toUploadPathname(src);
    if (!pathname || pathname.includes('\0')) return null;

    // The matcher is DERIVED from the theme-UI route template, so it tracks the route rather than
    // repeating it — see ApiPathUtils.themeUiAssetMatcher.
    const match = pathname.match(ApiPathUtils.themeUiAssetMatcher());
    if (!match) return null;

    const themesRoot = path.resolve(String(themesDir || ''));
    const themeRoot = path.resolve(themesRoot, match[1]);
    // The slug names ONE directory directly under the themes root — `..` or a nested path is not a theme.
    if (path.dirname(themeRoot) !== themesRoot) return null;
    // Confined to that theme's `ui`, not merely the themes root: `<a>/ui/../../<b>/ui/x` resolves inside
    // the themes root and would otherwise read another theme's files.
    const root = path.join(themeRoot, SystemConstants.THEME_DIR.UI);
    const resolved = path.resolve(root, match[2]);
    if (!resolved.startsWith(root + path.sep)) return null;
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
