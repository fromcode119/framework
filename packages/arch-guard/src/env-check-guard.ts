import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Hand-rolled ENVIRONMENT checks: `typeof window|document|navigator === 'undefined'`.
 *
 * `TypeofGuard` deliberately lets every `typeof x === 'undefined'` through, because an existence check
 * usually has no better form. These three are the exception — they ask "am I in a browser?", a question
 * the codebase already answers in one place:
 *
 *  - `Platform.isBrowser` / `Platform.hasWindow` (`@fromcode119/react-class-components`) for client React packages,
 *    which cannot depend on core.
 *  - `EnvUtils.isBrowser()` / `EnvUtils.isServer()` (core) for server and isomorphic framework code.
 *
 * Both utilities already existed and were already documented; with the check carved out of the guard,
 * 91 hand-rolled copies accumulated anyway. Ratcheted per area: the count may fall, never rise.
 */
export class EnvCheckGuard {
  /** `typeof window|document|navigator` compared against `'undefined'`, either direction. */
  private static readonly PATTERN =
    /typeof\s+(?:window|document|navigator)\s*[=!]==?\s*['"]undefined['"]/g;

  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git', 'tests', '__tests__',
  ]);

  /**
   * `reactor` / `next-build-codegen` / `typescript-multiple-inheritance` / `arch-guard` are the standalone layer that confines raw JS/TS mechanics —
   * a runtime type check is sometimes genuinely their job, and they cannot import the SDK to avoid it.
   */
  private static readonly EXEMPT_PACKAGES = new Set(['react-class-components', 'next-build-codegen', 'typescript-multiple-inheritance', 'arch-guard']);

  /** Pre-existing debt, counted 2026-09-09. LOWER as it is paid off; never raise. */
  static readonly BASELINE: Readonly<Record<string, number>> = {
    plugins: 31,
    themes: 34,
    framework: 17,
    appearance: 6,
  };


  /**
   * `ui` / `ui-ssr` are BUILD OUTPUT at a plugin or theme ROOT, but `src/ui` is SOURCE. Excluding the
   * directory by NAME skips every plugin's UI source — the exact mistake that made this guard silently
   * scan nothing. Skip by PATH: only when it is not under a `src/`.
   */
  private static isBuildOutput(full: string): boolean {
    const p = full.replace(/\\/g, '/');
    return /\/(ui|ui-ssr)$/.test(p) && !p.includes('/src/');
  }

  private static files(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      let isDir = false;
      try { isDir = statSync(full).isDirectory(); } catch { continue; }
      if (isDir) {
        if (EnvCheckGuard.SKIP_DIR.has(entry) || EnvCheckGuard.EXEMPT_PACKAGES.has(entry) || EnvCheckGuard.isBuildOutput(full)) continue;
        EnvCheckGuard.files(full, out);
      } else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  static violationsIn(file: string): string[] {
    let source: string;
    try { source = readFileSync(file, 'utf8'); } catch { return []; }
    if (!source.includes('typeof')) return [];
    const hits: string[] = [];
    source.split('\n').forEach((line, index) => {
      // A commented-out example is documentation, not code.
      if (/^\s*(\*|\/\/)/.test(line)) return;
      EnvCheckGuard.PATTERN.lastIndex = 0;
      const matches = line.match(EnvCheckGuard.PATTERN);
      if (matches) for (const match of matches) hits.push(`${index + 1}: ${match.trim().slice(0, 70)}`);
    });
    return hits;
  }

  static scan(roots: readonly { area: string; dir: string }[]): {
    counts: Record<string, number>;
    detail: { area: string; file: string; hits: string[] }[];
  } {
    const counts: Record<string, number> = {};
    const detail: { area: string; file: string; hits: string[] }[] = [];
    for (const { area, dir } of roots) {
      counts[area] = counts[area] ?? 0;
      for (const file of EnvCheckGuard.files(dir)) {
        const hits = EnvCheckGuard.violationsIn(file);
        if (!hits.length) continue;
        counts[area] += hits.length;
        detail.push({ area, file, hits });
      }
    }
    return { counts, detail };
  }
}
