export interface ISiteTransferBundleOptions {
  outputDir?: string;
  label?: string;
  includeUploads?: boolean;
  includePublic?: boolean;
  includeSecrets?: boolean;
  skipChecksum?: boolean;
}
