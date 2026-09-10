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
   * There is no accepted-differences list, and that is the finding, not an omission.
   *
   * One existed while `build-plugins.sh` was still the reference: its stylesheet marker named a
   * different generator, and it left `ui/tracker.js` unminified through an ordering accident. Both
   * entries described that script, and it is gone. Two builds of the same extension now produce
   * byte-identical trees — measured, with nothing excused — so ANY difference this harness reports
   * is a regression and there is nothing to exempt.
   *
   * If a genuine exception ever appears, it must not be an ignore list. Make it state what may
   * differ and assert that claim, and never name an extension: a framework package that knows a
   * plugin slug is a bug by this repo's own rule.
   */
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
  ): { onlyLeft: string[]; onlyRight: string[]; differing: string[] } {
    const onlyLeft = [...left.keys()].filter((f) => !right.has(f)).sort();
    const onlyRight = [...right.keys()].filter((f) => !left.has(f)).sort();
    const differing = [...left.keys()]
      .filter((f) => right.has(f) && right.get(f) !== left.get(f))
      .sort();
    return { onlyLeft, onlyRight, differing };
  }

}
