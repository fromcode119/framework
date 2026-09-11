/**
 * Events Sources EMITS for other extensions to react to. Sources has no knowledge of who
 * listens — the marketplace plugin subscribes to PACKAGE_BUILT to update its own catalog.
 */
export class SourcesEvents {
  static readonly PACKAGE_BUILT = 'sources:package_built';
}
