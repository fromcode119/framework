import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * User-facing copy must live in `i18n/*.json`, never as a string literal in `.ts`/`.tsx`.
 *
 * A literal is untranslatable by definition, and when it is passed as a `t(key, 'fallback')` default it
 * silently outranks the locale file — the translated string exists but never renders. This guard finds
 * non-ASCII (i.e. clearly natural-language, non-English) literals in render and service code.
 *
 * NOT flagged, deliberately:
 *  - `i18n/**` — that IS the copy.
 *  - `seeds/**` — seed content is initial CMS DATA that becomes editable records, not render-time copy.
 *  - comments — a Cyrillic comment is documentation, not output.
 *
 * Ratcheted per area: the count may fall, never rise. Lower a number when copy is extracted; never raise
 * one to make a build pass.
 */
export class HardcodedCopyGuard {
  /** Non-ASCII letters — Cyrillic, Greek, accented Latin. ASCII-only English is not flagged here. */
  private static readonly NON_ASCII = /[^\x00-\x7F]/;

  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git',
    'i18n', 'seeds', 'tests', '__tests__',
  ]);

  static readonly BASELINE: Readonly<Record<string, number>> = {
    plugins: 2748,
    themes: 513,
    framework: 244,
    appearance: 280,
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
        if (!HardcodedCopyGuard.SKIP_DIR.has(entry) && !HardcodedCopyGuard.isBuildOutput(full)) HardcodedCopyGuard.files(full, out);
      } else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  /**
   * Strip comments and template-literal EXPRESSIONS so only real string content is examined.
   * Deliberately simple: a false negative is acceptable, a false positive is not — this guard has to be
   * trustworthy enough that nobody reaches for a baseline bump.
   */
  private static stripComments(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  }

  /** Every non-ASCII string literal in the file, as `line:snippet`. */
  static violationsIn(file: string): string[] {
    let source: string;
    try { source = readFileSync(file, 'utf8'); } catch { return []; }
    if (!HardcodedCopyGuard.NON_ASCII.test(source)) return [];

    const hits: string[] = [];
    const lines = HardcodedCopyGuard.stripComments(source).split('\n');
    const literal = /'([^'\\\n]|\\.)*'|"([^"\\\n]|\\.)*"|`([^`\\]|\\.)*`/g;
    lines.forEach((line, index) => {
      const matches = line.match(literal);
      if (!matches) return;
      for (const match of matches) {
        if (!HardcodedCopyGuard.NON_ASCII.test(match)) continue;
        hits.push(`${index + 1}: ${match.trim().slice(0, 70)}`);
      }
    });
    return hits;
  }

  /** `{ area -> count }` plus the per-file detail, for every scanned root. */
  static scan(roots: readonly { area: string; dir: string }[]): {
    counts: Record<string, number>;
    detail: { area: string; file: string; hits: string[] }[];
  } {
    const counts: Record<string, number> = {};
    const detail: { area: string; file: string; hits: string[] }[] = [];
    for (const { area, dir } of roots) {
      counts[area] = counts[area] ?? 0;
      for (const file of HardcodedCopyGuard.files(dir)) {
        const hits = HardcodedCopyGuard.violationsIn(file);
        if (!hits.length) continue;
        counts[area] += hits.length;
        detail.push({ area, file, hits });
      }
    }
    return { counts, detail };
  }
}
