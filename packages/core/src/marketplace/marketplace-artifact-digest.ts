import * as crypto from 'crypto';

/**
 * Checks a downloaded marketplace package against the checksum the catalogue published for it.
 *
 * The catalogue publishes `artifactSha256` so an installation can verify a package with a value that
 * did not travel inside the package. Nothing compared it, so the published digest was decorative and a
 * package swapped on the way, or on the host, installed exactly like the real one.
 *
 * A missing digest is refused, not waved through: an entry that cannot be verified is an unverified
 * package, and installing executable code on that basis is the outcome the digest exists to prevent.
 */
export class MarketplaceArtifactDigest {
  static of(bytes: Buffer): string {
    return crypto.createHash('sha256').update(bytes).digest('hex');
  }

  static assertMatches(bytes: Buffer, expected: unknown, label: string): void {
    const published = String(expected ?? '').trim().toLowerCase();
    if (!published) {
      throw new Error(`The marketplace published no checksum for ${label}, so the download cannot be verified. Nothing was installed.`);
    }
    const actual = MarketplaceArtifactDigest.of(bytes);
    if (actual !== published) {
      throw new Error(`The download of ${label} does not match the checksum the marketplace published. Nothing was installed.`);
    }
  }
}
