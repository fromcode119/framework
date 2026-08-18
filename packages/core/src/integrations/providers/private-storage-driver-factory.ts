import { StorageFactory } from '@fromcode119/media';
import type { IStorageDriver } from '@fromcode119/media';
import { ProjectPaths } from '@core/config/paths';
import { Logger } from '@core/logging';

/**
 * Builds the driver for files that must never be served statically.
 *
 * Always LOCAL, regardless of which driver holds public media. The S3 driver has no signed-URL support
 * and no private ACL handling, so putting private files there would place them in the same
 * world-readable bucket as everything else — the opposite of the point. An install that wants private
 * files on object storage needs presigned URLs first; until then local disk is the honest option.
 *
 * Returns undefined rather than throwing when the directory is misconfigured. Private storage then
 * reports as unavailable and every private upload is refused, which is the safe failure. Constructing
 * it anyway would mean accepting files as private and writing them somewhere public.
 */
export class PrivateStorageDriverFactory {
  /**
   * The storage-space name. Deliberately the same string as `MediaVisibility.PRIVATE.value`, so a
   * media row's visibility IS the space its bytes live in — no mapping table between the two.
   */
  static readonly SPACE = 'private';

  private static readonly logger = new Logger({ namespace: 'private-storage' });

  /**
   * @param servedUploadDir the directory handed to `express.static`, so the containment check has
   *                        something concrete to compare against rather than re-deriving it.
   */
  static create(servedUploadDir: string): IStorageDriver | undefined {
    const privateDir = ProjectPaths.getPrivateUploadsDir();

    // The static mounts are registered before cookies, CSRF, auth and the rate limiter, so anything
    // reachable from them is anonymous by construction. No route guard can compensate for a private
    // directory that sits inside that tree.
    if (servedUploadDir && ProjectPaths.isServedStatically(privateDir, servedUploadDir)) {
      PrivateStorageDriverFactory.logger.error(
        `Private storage disabled: ${privateDir} resolves inside the statically served uploads directory (${servedUploadDir}). Point STORAGE_PRIVATE_DIR outside that tree.`
      );
      return undefined;
    }

    // No publicUrlBase: a private file has no public URL, and MediaManager.publicUrl never asks this
    // driver for one.
    return StorageFactory.create('local', { uploadDir: privateDir, publicUrlBase: '' });
  }
}
