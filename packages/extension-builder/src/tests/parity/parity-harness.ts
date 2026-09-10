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
   * Differences that are deliberate improvements, each stated with its reason. Anything not listed
   * here is a regression until proven otherwise.
   */
  static readonly ACCEPTED_DIFFERENCES: ReadonlyArray<{ file: string; reason: string }> = [
    {
      file: 'ui/tracker.js',
      reason: 'we minify it; build-plugins.sh missed it through step ordering (it mirrored after minifying). Both carry the browser require shim; ours is smaller',
    },
    {
      file: 'ui/style.css',
      reason: 'first line is the generator marker, which now names the builder instead of build-plugins.sh; the CSS below it is byte-identical',
    },
    {
      file: 'manifest.json',
      reason: 'holds the integrity checksum, which is a hash OF the tree — compared separately, and it must match',
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
  static compare(left: Map<string, string>, right: Map<string, string>): {
    onlyLeft: string[];
    onlyRight: string[];
    differing: string[];
  } {
    // The precompressed twin of an accepted difference is accepted BY DERIVATION, never as its own
    // entry: if `ui/style.css` legitimately differs, `ui/style.css.gz` cannot help but differ, and
    // listing it separately would invite someone to accept a .gz whose source file is NOT accepted.
    const named = ParityHarness.ACCEPTED_DIFFERENCES.map((d) => d.file);
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
