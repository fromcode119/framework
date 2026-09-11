export interface IPackageResult {
  /**
   * The cleaned, stamped package directory this build produced. THE artifact.
   *
   * A build used to produce only a zip, which an install then unpacked into the same shape this
   * directory already has — and, worse, the zip was made by glob-ignoring an uncleaned source tree
   * rather than by packaging it, so the cleaning, the theme's SSR dependency closure and the
   * checksum-over-cleaned-content never happened at all on the server path.
   *
   * Absent for a CORE build, which produces an archive that replaces the project root — a
   * different operation with different risks, deliberately left on the archive path.
   */
  stagedDir?: string;

  /**
   * The archive, when one was asked for. Absent when nothing asked to download this build.
   *
   * Optional rather than an empty string: "there is no archive" is a real answer, and a caller
   * that must have one should have to say so.
   */
  filePath?: string;
  fileName?: string;

  version: string;
  slug: string;
  manifest: Record<string, any>;

  /**
   * SHA-256 of the archive FILE — see ArtifactDigestService for why this is not the manifest
   * checksum. Absent for the same reason `filePath` is: there may be no file to digest.
   */
  artifactSha256?: string;
}
