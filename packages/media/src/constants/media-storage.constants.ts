/**
 * Storage defaults owned by the media package.
 *
 * These MIRROR `SystemConstants.STORAGE.*` in core and must stay in step with it. They are duplicated
 * deliberately, not by oversight: core imports media, so media importing core would close a circular
 * reference — the same reason `MediaCollection` declares its field types as literals. A driver
 * constructed by the framework is always handed the configured value, so this default only applies to a
 * driver built with nothing.
 *
 * The literals it replaces disagreed with each other: one branch returned `/uploads` and another
 * `uploads`, so the fallback path depended on which way the base URL failed to parse.
 */
export class MediaStorageConstants {
  /** Public base path for locally stored files. Mirrors `SystemConstants.STORAGE.DEFAULT_PUBLIC_URL`. */
  static readonly DEFAULT_PUBLIC_URL = '/uploads';

  /** The same value with no surrounding slashes, which is the form path-joining wants. */
  static get DEFAULT_PUBLIC_SEGMENT(): string {
    return MediaStorageConstants.DEFAULT_PUBLIC_URL.replace(/^\/+|\/+$/g, '');
  }
}
