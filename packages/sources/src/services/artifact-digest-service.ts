import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * SHA-256 of a built archive FILE.
 *
 * This is deliberately NOT the manifest checksum. The manifest checksum ships inside the package it
 * describes, so it is self-consistent: an attacker who authors a package also authors its checksum,
 * and it can never prove anything about where the package came from. The digest computed here is
 * recorded in the Sources table at the moment the archive is produced, and is handed to
 * an installer OUT OF BAND (through `sources:packages:resolve`). An installer that re-hashes
 * the file it is about to open and compares it to this value detects any substitution of the
 * artifact between build and install.
 *
 * It is not a provenance chain — it does not attest to the upstream repository, and it is not a
 * signature. Its single, stated guarantee is: the bytes being installed are the bytes that were
 * built.
 */
export class ArtifactDigestService {
  static readonly ALGORITHM = 'sha256';

  /** Hex digest of the file at `filePath`, or '' when the file cannot be read. */
  static async digestFile(filePath: string): Promise<string> {
    try {
      const hash = crypto.createHash(ArtifactDigestService.ALGORITHM);
      hash.update(await fs.promises.readFile(filePath));
      return hash.digest('hex');
    } catch {
      return '';
    }
  }
}
