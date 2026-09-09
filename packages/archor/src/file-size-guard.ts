import fs from 'node:fs';
import path from 'node:path';

/**
 * The file-size rule, applied to EVERY extension root rather than to plugins only.
 *
 * The limits have been documented since the beginning (`.ts` ≤ 300, `.tsx` ≤ 200) and 154 files break
 * them, four of them over 700 lines. The reason is not that anyone disagreed with the rule: it is that
 * the only thing checking it — the plugin-architecture guard — scans `../../plugins` and nothing else,
 * defaults to warn, and is not part of `build`. So the framework's own packages, the themes and the
 * appearances have never been measured at all, and a rule nothing measures is a preference.
 *
 * This measures all four roots and is a RATCHET: the count may fall, never rise. Splitting a file
 * lowers the baseline; adding a long one fails the build. That is the same shape as the app-typecheck
 * gate, and it is deliberately not a big-bang refactor — 154 files cannot be split safely at once.
 */
export class FileSizeGuard {
  static readonly TS_MAX_LINES = 300;
  static readonly TSX_MAX_LINES = 200;

  /**
   * The point where a file stops being merely over-length and becomes unreadable.
   *
   * Two tiers, because they are two different problems. A 320-line service is over the target and worth
   * splitting eventually; a 600-line one cannot be held in your head at all, and no amount of ratcheting
   * makes it readable. The limits above are the TARGET (ratcheted so nothing grows); this is the bucket
   * that has to reach zero. 400 is the operator's own line: "300-350 is ok, over 400-500 is not
   * readable".
   */
  static readonly UNREADABLE_LINES = 400;

  /**
   * Excluded by the same rules the plugin-architecture guard uses, so the two agree on what "a source
   * file" is. Tests, migrations and seeds are long by nature and splitting them buys nothing.
   */
  private static readonly IGNORED = [
    /[\\/]node_modules[\\/]/,
    /[\\/]dist[\\/]/,
    /[\\/]\.next[\\/]/,
    /\.test\.(ts|tsx)$/,
    /\.d\.ts$/,
    /[\\/]migrations[\\/]/,
    /[\\/]seed/i,
    /[\\/]tests?[\\/]/,
  ];

  /** The limit for one file, by extension. */
  static limitFor(filePath: string): number {
    return filePath.endsWith('.tsx') ? FileSizeGuard.TSX_MAX_LINES : FileSizeGuard.TS_MAX_LINES;
  }

  /** Every source file under `root` that is longer than its limit, longest first. */
  static findOversized(root: string): Array<{ file: string; lines: number; limit: number }> {
    const found: Array<{ file: string; lines: number; limit: number }> = [];
    FileSizeGuard.walk(root, (filePath) => {
      const limit = FileSizeGuard.limitFor(filePath);
      const lines = FileSizeGuard.countLines(filePath);
      if (lines > limit) found.push({ file: filePath, lines, limit });
    });
    return found.sort((left, right) => right.lines - left.lines);
  }

  /** The subset of {@link findOversized} that is past {@link UNREADABLE_LINES}. */
  static findUnreadable(root: string): Array<{ file: string; lines: number; limit: number }> {
    return FileSizeGuard.findOversized(root).filter((entry) => entry.lines >= FileSizeGuard.UNREADABLE_LINES);
  }

  private static walk(directoryPath: string, visit: (filePath: string) => void): void {
    if (!fs.existsSync(directoryPath)) return;
    for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
      const nextPath = path.join(directoryPath, entry.name);
      if (FileSizeGuard.IGNORED.some((pattern) => pattern.test(nextPath))) continue;
      if (entry.isDirectory()) {
        FileSizeGuard.walk(nextPath, visit);
        continue;
      }
      if (/\.(ts|tsx)$/.test(nextPath)) visit(nextPath);
    }
  }

  /**
   * Lines in the file. A trailing newline terminates the last line, it does not start a new one —
   * counting it made every file of exactly 300 lines read as 301 and fail.
   */
  private static countLines(filePath: string): number {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      if (!content) return 0;
      const parts = content.split('\n');
      return parts[parts.length - 1] === '' ? parts.length - 1 : parts.length;
    } catch {
      return 0;
    }
  }
}
