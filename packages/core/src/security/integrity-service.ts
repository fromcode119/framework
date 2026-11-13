import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Logger } from '@core/logging';
import { EnvUtils } from '@core/utils/env-utils';

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
   * Whether a directory is a version-controlled SOURCE checkout rather than an installed artifact.
   *
   * The checksum certifies an ARTIFACT: the cleaned, packed directory an installer writes. A source
   * checkout is not one. Its hash covers build output (`index.js`, the UI bundles) that the
   * repository ignores, so the value differs on every machine and after every build, and the copy
   * committed in `manifest.json` can never match. Stamping it anyway rewrote a tracked file on every
   * build and every boot: each checkout carried a permanent local change to `manifest.json`, and
   * because every release also moves that file's `version`, the checkout could no longer be
   * fast-forwarded to main. So a checkout is neither stamped nor verified. `.git` is a directory in
   * a clone and a file in a worktree; both count. A packed directory never has one — `PackCleaner`
   * removes it before the artifact is stamped.
   */
  public static isSourceCheckout(dirPath: string): boolean {
    return fs.existsSync(path.join(dirPath, '.git'));
  }

  /**
   * Verifies that a plugin's contents match its manifest checksum
   */
  public static async verifyPluginIntegrity(dirPath: string, expectedChecksum: string): Promise<boolean> {
    if (!expectedChecksum) return true; // Skip if no checksum provided
    if (this.isSourceCheckout(dirPath)) return true; // A checkout is not an artifact — see isSourceCheckout

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
    return EnvUtils.isProduction();
  }

  /**
   * Recompute a plugin's directory hash and write it back into its manifest.json
   * `checksum` field, returning the new checksum. Used to self-heal an installed
   * plugin whose stored checksum drifted (e.g. after a core upgrade) so it loads and
   * future boots are stable. The manifest.json is excluded from the hash, so writing
   * the checksum back does not invalidate it. Best-effort: if the manifest cannot be
   * written (read-only mount), the computed hash is still returned for in-memory use.
   *
   * A source checkout is never written to: the hash is returned and `manifest.json` is left as the
   * repository has it (see isSourceCheckout).
   */
  public static async restampPlugin(dirPath: string): Promise<string> {
    const checksum = await this.calculateDirectoryHash(dirPath);
    if (this.isSourceCheckout(dirPath)) return checksum;
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