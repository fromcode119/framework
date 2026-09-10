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

  /**
   * Every source file under `root` that is longer than its limit, longest first.
   *
   * `codeLines` is reported alongside `lines` but NOTHING is enforced on it. Measured 2026-09-09: only
   * 8 of the 19 files past {@link UNREADABLE_LINES} hold 400+ lines of actual code — `base-dialect.ts`
   * is 625 lines of which 244 are comments, leaving 320. Counting raw lines penalises the "why"
   * comments that are this codebase's house style, so the number is surfaced for judgement rather than
   * used as a gate.
   */
  static findOversized(root: string): Array<{ file: string; lines: number; codeLines: number; limit: number }> {
    const found: Array<{ file: string; lines: number; codeLines: number; limit: number }> = [];
    FileSizeGuard.walk(root, (filePath) => {
      const limit = FileSizeGuard.limitFor(filePath);
      const lines = FileSizeGuard.countLines(filePath);
      if (lines > limit) found.push({ file: filePath, lines, codeLines: FileSizeGuard.countCodeLines(filePath), limit });
    });
    return found.sort((left, right) => right.lines - left.lines);
  }

  /**
   * Lines that are neither blank nor comment — the logic you actually have to hold in your head.
   *
   * Deliberately a lexical scan, not a parse: a `//` inside a string literal is counted as code only
   * when the line has other content, which is close enough for a REPORTED figure and cannot be wrong in
   * a way that fails a build (nothing is enforced on this number).
   */
  static countCodeLines(filePath: string): number {
    let content: string;
    try { content = fs.readFileSync(filePath, 'utf8'); } catch { return 0; }
    let code = 0;
    let inBlock = false;
    for (const raw of content.split('\n')) {
      const line = raw.trim();
      if (inBlock) {
        if (line.includes('*/')) inBlock = false;
        continue;
      }
      if (!line) continue;
      if (line.startsWith('//')) continue;
      if (line.startsWith('/*')) {
        if (!line.includes('*/')) inBlock = true;
        continue;
      }
      code += 1;
    }
    return code;
  }

  /** The subset of {@link findOversized} that is past {@link UNREADABLE_LINES}. */
  static findUnreadable(root: string): Array<{ file: string; lines: number; codeLines: number; limit: number }> {
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
