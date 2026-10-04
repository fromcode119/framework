/**
 * Events Sources EMITS for other extensions to react to. Sources has no knowledge of who listens.
 */
export class SourcesEvents {
  /** A source finished building. Emitted at platform scope. */
  static readonly PACKAGE_BUILT = 'sources:package_built';
  /**
   * A built package was handed to a SITE (the source's "Publish builds to site"): its archive is in
   * that site's media library and this is emitted inside that site's scope, so only the extensions
   * that site runs hear it. Payload: IPackagePublishedEvent.
   */
  static readonly PACKAGE_PUBLISHED = 'sources:package_published';
}
