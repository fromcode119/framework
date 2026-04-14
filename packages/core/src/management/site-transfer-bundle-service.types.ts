export type SiteTransferBundleOptions = {
  outputDir?: string;
  label?: string;
  includeUploads?: boolean;
  includePublic?: boolean;
  includeSecrets?: boolean;
  skipChecksum?: boolean;
};

export type SiteTransferBundleManifest = {
  createdAt: string;
  label: string;
  repositoryRoot: string;
  frameworkRoot: string;
  frameworkVersion: string;
  activeTheme: {
    slug: string | null;
    version: string | null;
  };
  activePlugins: Array<{
    slug: string;
    version: string | null;
  }>;
  includedArtifacts: Array<{
    name: string;
    relativePath: string;
  }>;
  excludedPaths: string[];
  requiredEnvironmentKeys: string[];
  importChecklist: string[];
};

export type SiteTransferBundleResult = {
  bundleDirectory: string;
  manifestPath: string;
  archivePath: string;
  checksumPath: string | null;
  snapshotPath: string;
};