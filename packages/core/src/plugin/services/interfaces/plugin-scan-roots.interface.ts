/** The directories one discovery pass scans (`PluginScanRoots.collect`). */
export interface IPluginScanRoots {
  /** The framework's own extensions, shipped in the image. */
  bundledRoot: string;
  /** Slugs found under `bundledRoot`: always on, never uninstallable. */
  bundledSlugs: Set<string>;
  /** Every root, in scan order: the mounted plugins root first, so a source checkout wins. */
  roots: string[];
  /** A site's own upload root → that site's id. */
  rootOwners: Map<string, string>;
}
