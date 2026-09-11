export interface IPackageResult {
  filePath: string;
  fileName: string;
  version: string;
  slug: string;
  manifest: Record<string, any>;
  /** SHA-256 of the archive FILE — see ArtifactDigestService for why this is not the manifest checksum. */
  artifactSha256: string;
}
