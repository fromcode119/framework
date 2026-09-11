/**
 * How this installation was deployed, which decides whether it can update ITSELF.
 *
 * An image-based deployment cannot: the code is baked into a read-only image layer, so the in-place
 * updater — download a tarball, back up the tree, overwrite it — fails at the first step with
 * `EACCES: mkdir '/app/backups/system'`, and even if the filesystem allowed it, the next `docker
 * compose up` would restore the image's own files and silently undo the update. The upgrade for such
 * a deployment is to run the newer IMAGE.
 *
 * The image declares this itself (`FROMCODE_DEPLOYMENT=image` in the Dockerfile) rather than being
 * guessed at from a failed write: a probe would report "cannot update" for a source deployment whose
 * disk merely happened to be full.
 */
export class DeploymentKind {
  static readonly IMAGE = 'image';

  static get current(): string {
    return String(process.env.FROMCODE_DEPLOYMENT || '').trim().toLowerCase();
  }

  /** True when the running code came from a published image and cannot rewrite itself. */
  static get isImage(): boolean {
    return DeploymentKind.current === DeploymentKind.IMAGE;
  }
}
