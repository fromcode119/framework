import path from 'path';

/**
 * Decides the Cache-Control header for a served theme/plugin asset from its FILENAME.
 *
 * Never from `?v=`: that token carries the theme/plugin VERSION, not a content fingerprint. Any
 * rebuild of the same version changes the bytes while the URL stays identical, so pinning a `?v=`
 * URL as `immutable` serves a stale entry shim that imports an `index-<hash>.js` the next build
 * already deleted — a hard 404 for every client holding that cache entry, for the whole max-age.
 */
export class AssetCacheHeaderService {
  static readonly PRODUCTION = 'public, max-age=2592000';
  static readonly IMMUTABLE = 'public, max-age=31536000, immutable';
  static readonly REVALIDATE = 'public, max-age=0, must-revalidate';
  static readonly DISABLED = 'no-store, no-cache, must-revalidate, proxy-revalidate';

  /**
   * A build-tool content hash suffix (`index-CbnDAPiz.js`, `vendor-chakra-T5GSHTrK.css`,
   * `checkout-flow-form-field--f18VEHa.js`): a dash plus exactly 8 base64url chars. The name
   * changes whenever the bytes do, which is the only property that makes `immutable` safe.
   *
   * Mixed case is required so ordinary hyphenated names are not mistaken for hashes
   * (`montserrat-400-latin.woff2`, `vselenskiportal88-theme.css`). Both misreads are safe by
   * construction: an all-lowercase hash (~0.03% of hashes) merely gets the shorter cache, and a
   * lowercase real name never reaches `immutable`.
   */
  private static readonly CONTENT_HASH_SUFFIX = /-([A-Za-z0-9_-]{8})\.[a-z0-9]+$/;

  private static isContentHashed(filename: string): boolean {
    const hash = filename.match(AssetCacheHeaderService.CONTENT_HASH_SUFFIX)?.[1];
    return !!hash && /[A-Z]/.test(hash) && /[a-z]/.test(hash);
  }

  /**
   * Extensions whose contents REFERENCE other hashed assets (an entry shim imports
   * `./index-<hash>.js`; a stylesheet `url()`s its chunks). Serving these stale outlives the files
   * they point at, so they revalidate unless their own filename is content-hashed. An ETag makes
   * that a cheap 304. Fonts/images reference nothing that can disappear and keep the long cache.
   */
  private static readonly REFERENCING_EXTENSIONS = new Set(['.js', '.mjs', '.css']);

  static resolve(absolutePath: string): string {
    const filename = path.basename(String(absolutePath || '')).replace(/\.gz$/i, '');
    if (AssetCacheHeaderService.isContentHashed(filename)) {
      return AssetCacheHeaderService.IMMUTABLE;
    }
    const extension = path.extname(filename).toLowerCase();
    return AssetCacheHeaderService.REFERENCING_EXTENSIONS.has(extension)
      ? AssetCacheHeaderService.REVALIDATE
      : AssetCacheHeaderService.PRODUCTION;
  }
}
