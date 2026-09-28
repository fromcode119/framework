import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

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
  /**
   * Trees whose copy has been extracted into their dictionaries in full, relative to the framework
   * root. Inside one, a rendered literal FAILS the run instead of adding to the report: the tree
   * reached zero, so the next literal is a regression, not backlog.
   *
   * `packages/admin` — the console, extracted into `packages/admin/i18n/<locale>.json` so choosing a
   * language in Settings → Localization changes every screen.
   * `packages/ai` — the assistant screen inside the console, in `packages/ai/src/i18n/<locale>.json`.
   */
  static readonly TRANSLATED = ['packages/admin', 'packages/ai', 'packages/core', 'packages/frontend', 'packages/react', 'packages/sdk'];

  /**
   * Whether a rendered literal in `file` is a regression rather than backlog: the file sits in a
   * {@link TRANSLATED} tree, or in an extension's `src/ui` that ships its own `src/ui/i18n/en.json`.
   * Shipping that dictionary is the extension saying its screens are translated, so from then on every
   * word they show comes from it — a new literal would show English in every other language.
   */
  static isEnforced(file: string): boolean {
    const normalized = file.replace(/\\/g, '/');
    return RenderedCopyGuard.TRANSLATED.some((tree) => normalized.includes(`/${tree}/`)) || RenderedCopyGuard.inTranslatedExtensionUi(normalized);
  }

  /** Under an extension's `src/ui` whose `src/ui/i18n/en.json` exists. */
  static inTranslatedExtensionUi(file: string): boolean {
    const normalized = file.replace(/\\/g, '/');
    const at = normalized.lastIndexOf('/src/ui/');
    return at >= 0 && existsSync(`${normalized.slice(0, at)}/src/ui/i18n/en.json`);
  }

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

  /**
   * Attributes a person actually reads. `className`/`key`/`href`/`role`/`type` are NOT here.
   *
   * Read from the syntax tree, not by pattern: the line patterns this used to be matched a return
   * type (`=> Promise<void>`) as text between tags and reported generics as untranslated copy.
   */
  private static readonly SPOKEN_ATTR = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label']);

  /** `label: 'Users'` — the descriptor shape menus, columns and fields use for their caption. */
  private static readonly CAPTION_PROP = new Set(['label', 'title', 'placeholder', 'description']);

  /**
   * A proper name or a format, not a sentence: `GitHub`, `WebP`, `TLS`, `JSON`. One token with a
   * capital after its first letter reads the same in every language, so it is not copy to translate.
   * `Delete` is a word and still counts.
   */
  private static readonly PROPER_NAME = /^[A-Z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*$/;

  /**
   * A token shaped like code rather than like a word: a path, an email, a host, a `:placeholder`, a
   * `table_name`, a `--flag`, a PEM `-----BEGIN` marker. `data/sources`, `ops@example.com`,
   * `acme.example.com` and `fcp_telemetry_events` are examples of what to type, spelled the same in
   * every language. A string counts as copy only if at least one of its words is NOT such a token:
   * `e.g. laptop` and `/new-page or https://…` still count, because `laptop` and `or` are words.
   */
  private static readonly CODE_TOKEN = /[/.@_:]|--|^-|-$|^[A-Z0-9]+(-[A-Z0-9]+)+$|^[A-Za-z]+=$|^[a-z]+-[0-9]+$|^[0-9.]+(px|rem|em|%|vh|vw)$/;

  /** A PEM armour line — `-----BEGIN PRIVATE KEY-----` — marks the whole string as a key's shape. */
  private static readonly PEM = /-----(BEGIN|END) /;

  /** A single literal shown in quotes — `"home"`, `"/"` — is the value it names, not a sentence. */
  private static readonly QUOTED_LITERAL = /^["'`][^\s"'`]+["'`]$/;

  /** Text inside these elements is code the operator reads verbatim, never translated copy. */
  private static readonly CODE_ELEMENTS = new Set(['code', 'pre', 'kbd', 'samp']);

  private static isCopy(text: string): boolean {
    const plain = text.replace(RenderedCopyGuard.HTML_ENTITY, '').replace(/\s+/g, ' ').trim();
    if (!RenderedCopyGuard.HAS_WORD.test(plain)) return false;
    if (RenderedCopyGuard.PROPER_NAME.test(plain) || RenderedCopyGuard.QUOTED_LITERAL.test(plain) || RenderedCopyGuard.PEM.test(plain)) return false;
    const words = plain.split(/[\s,()]+/).filter((token) => RenderedCopyGuard.HAS_WORD.test(token));
    return words.some((token) => !RenderedCopyGuard.CODE_TOKEN.test(token));
  }

  /** Whether `node` sits inside a `<code>`/`<pre>`/`<kbd>`/`<samp>` element. */
  private static insideCode(node: ts.Node, sf: ts.SourceFile): boolean {
    for (let up: ts.Node | undefined = node.parent; up; up = up.parent) {
      if (ts.isJsxElement(up) && RenderedCopyGuard.CODE_ELEMENTS.has(up.openingElement.tagName.getText(sf))) return true;
    }
    return false;
  }

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
      } else if (/\.ts$/.test(entry) && !/\.(test|spec|d)\.ts$/.test(entry) && RenderedCopyGuard.inTranslatedExtensionUi(full)) {
        // Inside a translated extension UI a `.ts` option list or presenter shows its labels too.
        out.push(full);
      }
    }
    return out;
  }

  /** Every rendered literal in the file, as `line: snippet`. Comments are not nodes, so never read. */
  static violationsIn(file: string): string[] {
    let source: string;
    try { source = readFileSync(file, 'utf8'); } catch { return []; }

    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const hits: string[] = [];
    const report = (node: ts.Node, text: string): void => {
      if (!RenderedCopyGuard.isCopy(text)) return;
      hits.push(`${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}: ${text.replace(/\s+/g, ' ').trim().slice(0, 70)}`);
    };
    const visit = (node: ts.Node): void => {
      if (ts.isJsxText(node)) {
        if (!RenderedCopyGuard.insideCode(node, sf)) report(node, node.text);
      } else if (ts.isJsxAttribute(node) && RenderedCopyGuard.SPOKEN_ATTR.has(node.name.getText(sf))) {
        const init = node.initializer;
        if (init && ts.isStringLiteral(init)) report(node, init.text);
        if (init && ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)) report(node, init.expression.text);
      } else if (ts.isPropertyAssignment(node) && RenderedCopyGuard.CAPTION_PROP.has(node.name.getText(sf).replace(/['"]/g, ''))
        && ts.isStringLiteralLike(node.initializer)) {
        report(node, node.initializer.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
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
