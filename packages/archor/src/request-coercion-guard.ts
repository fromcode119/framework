import fs from 'node:fs';
import path from 'node:path';

/**
 * Request values coerced by hand instead of through `CoercionUtils.toString`.
 *
 * `CoercionUtils.toString(req.params.x)` is not an equivalent, and the difference is not cosmetic:
 *   - it does not trim, so " a " and "a" become two different ids;
 *   - Express hands you an OBJECT for a bracketed query (`?x[k]=v`), and `String({})` is the literal
 *     `"[object Object]"` — the very value that reached production once already and had to be hunted
 *     down afterwards.
 * `CoercionUtils.toString` trims, and answers `''` for anything with no meaningful string form.
 *
 * Reports; never gates. The list is burned down file by file on purpose: a blanket regex across this
 * codebase has corrupted it before.
 */
export class RequestCoercionGuard {
  /** Directories that hold no reviewable source. */
  private static readonly SKIP = ['node_modules', 'dist', '.next', '.git', 'ui-ssr', 'archive', 'tests'];

  /**
   * Deliberately NOT matching `CoercionUtils.toString(req…)`: the leading boundary rules out a
   * preceding dot, which is what separates a hand-rolled `String(` from a method call.
   */
  private static readonly PATTERN = /(^|[^.\w])String\(\s*req\??\.(params|query|body)\b/;

  static run(): number {
    const root = process.cwd();
    const targets = [
      path.resolve(root, 'packages'),
      path.resolve(root, '../../plugins'),
      path.resolve(root, '../../themes'),
    ];

    const perFile = new Map<string, number>();
    let total = 0;
    for (const target of targets) {
      for (const file of RequestCoercionGuard.sources(target, [])) {
        const count = RequestCoercionGuard.countIn(file);
        if (!count) continue;
        perFile.set(path.relative(root, file), count);
        total += count;
      }
    }

    console.log(`Hand-rolled request coercions: ${total} in ${perFile.size} files`);
    // Worded to avoid spelling the bad form: this guard would otherwise flag its own help text.
    console.log('Read request values with CoercionUtils.toString(req.params?.x); a bare coercion neither');
    console.log('trims nor guards an object, which is how "[object Object]" reached real data before.\n');
    for (const [file, count] of [...perFile.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(3)}  ${file}`);
    }
    return 0;
  }

  private static countIn(file: string): number {
    let found = 0;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      if (RequestCoercionGuard.PATTERN.test(line)) found += 1;
    }
    return found;
  }

  private static sources(dir: string, out: string[]): string[] {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const entry of entries) {
      if (RequestCoercionGuard.SKIP.includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        RequestCoercionGuard.sources(full, out);
      } else if (/\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }
}
