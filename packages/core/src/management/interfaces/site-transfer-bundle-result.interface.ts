export interface ISiteTransferBundleResult {
  bundleDirectory: string;
  manifestPath: string;
  archivePath: string;
  checksumPath: string | null;
  snapshotPath: string;
}
