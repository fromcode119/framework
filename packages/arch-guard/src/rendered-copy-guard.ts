import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * User-facing copy rendered from a `.tsx` file, in ANY language, instead of from `i18n/*.json`.
 *
 * {@link HardcodedCopyGuard} finds copy in the wrong LANGUAGE — a Cyrillic or CJK letter sitting in
 * code. That is a strong signal and a narrow one: English copy is Latin, so it never matched, and an
 * admin console written entirely in hardcoded English passed a guard named "hardcoded copy" cleanly.
 * The gap was found when a reviewer asked why `label: 'people'` shipped.
 *
 * Widening the OTHER guard to "any string literal in a .tsx" is what its own docblock warns against:
 * the version that matched any non-ASCII byte reported 496 violations in the framework, essentially
 * all of them well-typeset English, and the number was useless. So this guard does not look at string
 * literals in general. It looks at the three places a literal is unambiguously *rendered to a person*:
 *
 *  1. **JSX text nodes** — `<span>Arrives</span>`. Text between tags IS the output.
 *  2. **User-facing JSX attributes** — `placeholder`, `title`, `aria-label`, `alt`, `label`. Each is
 *     read aloud by a screen reader or shown on hover; `className`, `key`, `href`, `role`, `type` and
 *     the rest are not, and are deliberately absent.
 *  3. **`label` / `title` / `placeholder` / `description` object properties** — the shape every menu,
 *     column and field descriptor in this codebase uses to carry its own caption.
 *
 * Everything else a `.tsx` contains — imports, class names, enum values, route segments, test ids —
 * is invisible to this guard by construction, because none of it reaches a screen.
 *
 * NOT flagged, deliberately:
 *  - `i18n/**` — that IS the copy.
 *  - `seeds/**` — seed content becomes editable records; it is data, not render-time copy.
 *  - tests — a fixture caption is not shipped UI.
 *  - comments — documentation, not output.
 *  - text with no two consecutive letters (`·`, `—`, `1,240`) — punctuation and figures are not copy.
 *
 * The target is zero, like every guard here. A literal that is genuinely not copy is a reason to
 * narrow what this MATCHES, argued in this file where it can be read — never a number in a table.
 */
export class RenderedCopyGuard {
  /** Two consecutive Latin letters: enough to be a word, so separators and figures are skipped. */
  private static readonly HAS_WORD = /[A-Za-z]{2,}/;

  /**
   * An HTML entity is punctuation spelled with letters — `&middot;`, `&nbsp;`, `&mdash;`.
   *
   * It matched {@link HAS_WORD} on the letters inside it, so a separator written as an entity was
   * reported as untranslated copy. It is the same category error the sibling guard made with em
   * dashes: a mark shared across every language says nothing about which language a file is in.
   * Entities are stripped BEFORE the word test, so `&middot;` alone is not copy but
   * `Save &amp; close` still is.
   */
  private static readonly HTML_ENTITY = /&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/g;

  /** Text between tags, with no interpolation — an expression is a value, not authored copy. */
  private static readonly JSX_TEXT = />([^<>{}\n]*[A-Za-z]{2,}[^<>{}\n]*)</g;

  /** Attributes a person actually reads. `className`/`key`/`href`/`role`/`type` are NOT here. */
  private static readonly SPOKEN_ATTR = /\b(placeholder|title|aria-label|alt|label)=["']([^"'\n]{2,})["']/g;

  /** `label: 'Users'` — the descriptor shape menus, columns and fields use for their caption. */
  private static readonly CAPTION_PROP = /\b(label|title|placeholder|description)\s*:\s*['"]([^'"\n]{2,})['"]/g;

  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git',
    'i18n', 'seeds', 'tests', '__tests__',
  ]);

  /**
   * `ui` / `ui-ssr` are BUILD OUTPUT at an extension root, but `src/ui` is SOURCE — the same
   * distinction {@link HardcodedCopyGuard} makes, and for the same reason: skipping by NAME would
   * skip every plugin's UI source and leave this guard scanning nothing.
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
        if (!RenderedCopyGuard.SKIP_DIR.has(entry) && !RenderedCopyGuard.isBuildOutput(full)) RenderedCopyGuard.files(full, out);
      } else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  /** Strip comments so a documented example is not read as shipped copy. */
  private static stripComments(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  }

  /** Every rendered literal in the file, as `line: snippet`. */
  static violationsIn(file: string): string[] {
    let source: string;
    try { source = readFileSync(file, 'utf8'); } catch { return []; }

    const hits: string[] = [];
    const lines = RenderedCopyGuard.stripComments(source).split('\n');
    lines.forEach((line, index) => {
      const found: string[] = [];
      for (const match of line.matchAll(RenderedCopyGuard.JSX_TEXT)) found.push(match[1].trim());
      for (const match of line.matchAll(RenderedCopyGuard.SPOKEN_ATTR)) found.push(`${match[1]}="${match[2]}"`);
      for (const match of line.matchAll(RenderedCopyGuard.CAPTION_PROP)) found.push(`${match[1]}: '${match[2]}'`);
      for (const text of found) {
        if (!RenderedCopyGuard.HAS_WORD.test(text.replace(RenderedCopyGuard.HTML_ENTITY, ''))) continue;
        hits.push(`${index + 1}: ${text.slice(0, 70)}`);
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
      for (const file of RenderedCopyGuard.files(dir)) {
        const hits = RenderedCopyGuard.violationsIn(file);
        if (!hits.length) continue;
        counts[area] += hits.length;
        detail.push({ area, file, hits });
      }
    }
    return { counts, detail };
  }
}
