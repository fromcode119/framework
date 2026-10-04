/**
 * Payload of SourcesEvents.PACKAGE_PUBLISHED — what a site's extensions learn about a package the
 * platform handed to that site. Everything an extension needs to list it, and the file itself as a
 * media id in the site's own library.
 */
export interface IPackagePublishedEvent {
  /** `plugin`, `theme`, `appearance` or `core`. */
  type: string;
  slug: string;
  version: string;
  /** What the package's own manifest says; '' when it says nothing. */
  name: string;
  description: string;
  author: string;
  /** SHA-256 of the archive the site received. */
  artifactSha256: string;
  /** The archive, as a record in the site's media library. */
  mediaId: string;
}
