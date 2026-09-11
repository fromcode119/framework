/**
 * Which published images to keep after a successful deploy.
 *
 * Nine releases in one day took a staging disk from 16G to 25G, because nothing ever removed what a
 * release replaced. Two are kept: the one now serving, and the one it replaced — the rollback
 * target. Everything else is superseded twice over and can be pulled again.
 */
export class ImageRetention {
  static readonly REGISTRY_PREFIX = 'ghcr.io/fromcode119/framework-';

  /**
   * Re-deploying the SAME version is the case that needs care: the version being replaced is then
   * the version being deployed, and a keep-set built from those two collapses to one — which would
   * delete the only image a rollback could use. The caller passes the last version actually
   * replaced, remembered across runs, rather than whatever `.env` happened to hold.
   */
  static keepSet(deployed: string, rollback: string): Set<string> {
    return new Set([deployed, rollback].filter((version) => version !== ''));
  }

  /** Only OUR images are candidates — postgres, redis and traefik are never touched. */
  static prunable(images: string[], keep: Set<string>): string[] {
    return images
      .map((line) => line.trim())
      .filter((line) => line.startsWith(ImageRetention.REGISTRY_PREFIX))
      .filter((line) => !keep.has(line.slice(line.lastIndexOf(':') + 1)));
  }
}
