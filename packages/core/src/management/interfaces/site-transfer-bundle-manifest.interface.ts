export interface ISiteTransferBundleManifest {
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
}
