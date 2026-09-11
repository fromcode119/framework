import { BuildSourceType } from '@sources/sources/enums/build-source-type.enum';

/**
 * Payload of the SourcesEvents.PACKAGE_BUILT event. sources announces what it built and
 * leaves catalog persistence (and the download-URL scheme) entirely to whoever listens (the
 * marketplace plugin) — no cross-plugin coupling, no knowledge of the marketplace's tables or URLs.
 */
export interface IPackageBuiltEvent {
  type: BuildSourceType;
  slug: string;
  version: string;
  /**
   * The archive's filename, when this build produced one.
   *
   * Optional because a build no longer necessarily writes an archive: it stages a package
   * directory, and a zip is made on request for a download. A consumer that needs a file asks for
   * one; being told a filename that does not exist yet would be worse than being told nothing.
   */
  fileName?: string;
  manifest: Record<string, any>;
  /**
   * SHA-256 of the archive file. Carried on the event so a catalog can PUBLISH it: a consumer that
   * downloads the package has no other way to obtain a hash that did not travel inside the package.
   * Absent whenever `fileName` is, and for the same reason.
   */
  artifactSha256?: string;
}
