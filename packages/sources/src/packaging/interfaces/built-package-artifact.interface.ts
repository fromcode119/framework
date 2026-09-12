import type { ExtensionScope } from '@fromcode119/core';

/** Everything known about a built package: where it is, and where a download would come from. */
export interface IBuiltPackageArtifact {
  /** The cleaned, checksum-stamped package directory. Null when no build has recorded a version. */
  stagedDir: string | null;
  /** The archive, if one has been written. Core only ever has this. */
  filePath: string | null;
  fileName: string | null;
  /** The route that MAKES a download — it zips the staged package on request. */
  downloadPath: string;
  /** SHA-256 of the archive, when one exists. Empty means none has been written. */
  artifactSha256: string;
  type: ExtensionScope;
  version?: string;
}
