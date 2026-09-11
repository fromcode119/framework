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
  fileName: string;
  manifest: Record<string, any>;
  /**
   * SHA-256 of the archive file. Carried on the event so a catalog can PUBLISH it: a consumer that
   * downloads the package has no other way to obtain a hash that did not travel inside the package.
   */
  artifactSha256: string;
}
