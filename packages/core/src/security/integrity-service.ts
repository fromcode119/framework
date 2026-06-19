import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Logger } from '../logging';

export class IntegrityService {
  private static logger = new Logger({ namespace: 'integrity-service' });

  /**
   * Files/directories excluded from the integrity hash. These MUST be identical
   * between checksum generation (build-plugins.sh) and verification here, or every
   * plugin would fail its integrity check. In addition to these names, any entry
   * starting with "." (dotfiles like .git, .fromcode-plugin-deps.json) is skipped.
   *
   *  - manifest.json: holds the checksum itself — hashing it would be self-referential.
   *  - node_modules:  installed at runtime, never part of the published surface.
   *  - package-lock.json: may be (re)written by a runtime `npm install`, so it is not
   *    stable between generation and verification.
   */
  public static readonly EXCLUDED_ENTRIES: ReadonlySet<string> = new Set([
    'manifest.json',
    'node_modules',
    'package-lock.json',
  ]);

  /**
   * Calculates the SHA-256 hash of a directory's contents
   */
  public static async calculateDirectoryHash(dirPath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    await this.processDirectory(dirPath, hash);
    return hash.digest('hex');
  }

  private static async processDirectory(dirPath: string, hash: crypto.Hash): Promise<void> {
    const items = fs.readdirSync(dirPath).sort(); // Sort to ensure deterministic hashing

    for (const item of items) {
      if (item.startsWith('.') || this.EXCLUDED_ENTRIES.has(item)) continue;

      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        await this.processDirectory(fullPath, hash);
      } else {
        const content = fs.readFileSync(fullPath);
        hash.update(item);
        hash.update(content);
      }
    }
  }

  /**
   * Verifies that a plugin's contents match its manifest checksum
   */
  public static async verifyPluginIntegrity(dirPath: string, expectedChecksum: string): Promise<boolean> {
    if (!expectedChecksum) return true; // Skip if no checksum provided

    try {
      const actualChecksum = await this.calculateDirectoryHash(dirPath);
      if (actualChecksum !== expectedChecksum) {
        this.logger.error(`Integrity Check Failed at ${dirPath}. Expected: ${expectedChecksum}, got: ${actualChecksum}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.error(`Integrity Check Error: ${e}`);
      return false;
    }
  }

  /**
   * Whether a checksum MISMATCH should hard-fail (disable) the plugin.
   *
   * ENFORCED BY DEFAULT IN PRODUCTION. When NODE_ENV === 'production' a mismatch
   * throws ("Security Violation: Integrity check failed") unless the operator
   * explicitly opts out with ENFORCE_PLUGIN_INTEGRITY=false (e.g. immediately
   * after a core upgrade whose hash recipe changed, while plugins are re-stamped).
   *
   * Outside production the default stays permissive: a mismatch is almost always
   * a core-version hash-recipe change or an in-place dev rebuild, NOT tampering,
   * so we self-heal by re-stamping from the on-disk content. Set
   * ENFORCE_PLUGIN_INTEGRITY=true to opt in to strict behavior in dev too.
   * Cryptographic tamper protection is signature enforcement
   * (ENFORCE_PLUGIN_SIGNATURES), which a core upgrade cannot false-positive.
   */
  public static isEnforced(): boolean {
    const flag = String(process.env.ENFORCE_PLUGIN_INTEGRITY || '').trim().toLowerCase();
    if (flag === 'true') return true;
    if (flag === 'false') return false;
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Recompute a plugin's directory hash and write it back into its manifest.json
   * `checksum` field, returning the new checksum. Used to self-heal an installed
   * plugin whose stored checksum drifted (e.g. after a core upgrade) so it loads and
   * future boots are stable. The manifest.json is excluded from the hash, so writing
   * the checksum back does not invalidate it. Best-effort: if the manifest cannot be
   * written (read-only mount), the computed hash is still returned for in-memory use.
   */
  public static async restampPlugin(dirPath: string): Promise<string> {
    const checksum = await this.calculateDirectoryHash(dirPath);
    const manifestPath = path.join(dirPath, 'manifest.json');
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest.checksum = checksum;
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    } catch (e) {
      this.logger.warn(`Could not persist re-stamped checksum to ${manifestPath}: ${e}`);
    }
    return checksum;
  }
}