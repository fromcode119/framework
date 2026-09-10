import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';

/**
 * Compares what `build-plugins.sh` produces against what the extension builder produces.
 *
 * Compares EXTRACTED TREES by content hash, never archive bytes: gzip embeds an mtime and tar
 * embeds ownership, so two correct archives of identical content differ. Where an output is
 * genuinely nondeterministic, it is normalised EXPLICITLY and by name — a blanket "ignore what
 * differs" rule would absorb exactly the regressions this harness exists to catch.
 */
export class ParityHarness {
  /**
   * Differences that are deliberate — each stated with its reason AND a check that must still pass.
   *
   * No entry may name an extension. A framework package that hardcodes a plugin slug is a bug by
   * this repo's own rule, and scoping an exception to one named plugin was that same bug written more
   * explicitly. Every entry here is a property of the BUILDER, true of any extension.
   *
   * `verify` is what keeps this from being an ignore list. An exemption says "never look again"; a
   * predicate says "this may differ, but only in the way I claim". If the claim stops holding, the
   * difference is reported like any other.
   */
  static readonly ACCEPTED_DIFFERENCES: ReadonlyArray<{
    file: string;
    reason: string;
    verify?: (bashFile: string, builderFile: string) => boolean;
  }> = [
    {
      file: 'ui/tracker.js',
      reason: 'the builder minifies every ui/*.js; build-plugins.sh minified only what existed at its ordering point and mirrored the tracker in afterwards. Verified rather than waved through: both must keep the browser require shim, and ours must not be larger',
      verify: (bashFile, builderFile) => {
        const bash = fs.readFileSync(bashFile, 'utf8');
        const builder = fs.readFileSync(builderFile, 'utf8');
        const shim = 'Dynamic require of ';
        if (bash.includes(shim) && !builder.includes(shim)) return false;
        return builder.length <= bash.length;
      },
    },
    {
      file: 'ui/style.css',
      reason: 'the first line is the generator marker, which names the builder rather than build-plugins.sh. Verified: everything below line one must be byte-identical',
      verify: (bashFile, builderFile) =>
        ParityHarness.styleSheetBodyHash(bashFile) === ParityHarness.styleSheetBodyHash(builderFile),
    },
    {
      file: 'manifest.json',
      reason: 'carries the integrity checksum, which is a hash OF the tree. Verified: both must be present and non-empty, and the tree hash is asserted by the caller',
      verify: (bashFile, builderFile) =>
        Boolean(JSON.parse(fs.readFileSync(bashFile, 'utf8')).checksum)
        && Boolean(JSON.parse(fs.readFileSync(builderFile, 'utf8')).checksum),
    },
  ];

  /**
   * A `.gz` is hashed by its DECOMPRESSED payload.
   *
   * This is a normalisation, not an exemption: the `gzip` CLI writes the source filename and an
   * mtime into the header, so two correct archives of identical content never match byte-for-byte.
   * Comparing payloads still catches a genuinely different bundle — which is exactly how the
   * missing require shim was found.
   */
  private static contentHash(file: string): string {
    const raw = fs.readFileSync(file);
    const bytes = file.endsWith('.gz') ? zlib.gunzipSync(raw) : raw;
    return crypto.createHash('sha256').update(bytes).digest('hex');
  }

  /** Every file in a tree, relative path -> sha256 of its content. */
  static hashTree(root: string, skipDirs: ReadonlySet<string> = new Set(['node_modules', '.git'])): Map<string, string> {
    const out = new Map<string, string>();
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!skipDirs.has(entry.name)) walk(path.join(dir, entry.name));
          continue;
        }
        const full = path.join(dir, entry.name);
        out.set(path.relative(root, full), ParityHarness.contentHash(full));
      }
    };
    walk(root);
    return out;
  }

  /** Files present in one tree only, or present in both with different content. */
  static compare(
    left: Map<string, string>,
    right: Map<string, string>,
    roots?: { left: string; right: string },
  ): { onlyLeft: string[]; onlyRight: string[]; differing: string[] } {
    // The precompressed twin of an accepted difference is accepted BY DERIVATION, never as its own
    // entry: if `ui/style.css` legitimately differs, `ui/style.css.gz` cannot help but differ, and
    // listing it separately would invite someone to accept a .gz whose source file is NOT accepted.
    // An entry is accepted only if its own claim still holds. Without roots there is nothing to
    // check against, so nothing is accepted — a caller that cannot verify does not get to exempt.
    const holds = (entry: (typeof ParityHarness.ACCEPTED_DIFFERENCES)[number]): boolean => {
      if (!entry.verify) return true;
      if (!roots) return false;
      const bashFile = path.join(roots.left, entry.file);
      const builderFile = path.join(roots.right, entry.file);
      if (!fs.existsSync(bashFile) || !fs.existsSync(builderFile)) return false;
      try {
        return entry.verify(bashFile, builderFile);
      } catch {
        return false;
      }
    };
    const named = ParityHarness.ACCEPTED_DIFFERENCES.filter(holds).map((d) => d.file);
    const accepted = new Set([...named, ...named.map((f) => `${f}.gz`)]);
    const onlyLeft = [...left.keys()].filter((f) => !right.has(f)).sort();
    const onlyRight = [...right.keys()].filter((f) => !left.has(f)).sort();
    const differing = [...left.keys()]
      .filter((f) => right.has(f) && right.get(f) !== left.get(f) && !accepted.has(f))
      .sort();
    return { onlyLeft, onlyRight, differing };
  }

  /** The CSS below the marker line, so the one accepted difference can still be verified. */
  static styleSheetBodyHash(file: string): string {
    if (!fs.existsSync(file)) return '';
    const body = fs.readFileSync(file, 'utf8').split('\n').slice(1).join('\n');
    return crypto.createHash('sha256').update(body).digest('hex');
  }
}
