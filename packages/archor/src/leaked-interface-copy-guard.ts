import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * An interface name must never appear in USER-FACING COPY.
 *
 * The I-prefix migration rewrote ordinary nouns that share a name with an interface — `Message`,
 * `Course`, `Column`, `Version` — **inside string literals and JSX text**, where the word is prose.
 * That shipped as admin labels ("Success IMessage"), a field labelled "Free ICourse", and schema.org
 * JSON-LD emitting `"@type": "ICourse"` — invalid structured data. Every build gate passed; only
 * reading the rendered page revealed it.
 *
 * The vocabulary is DERIVED, never listed: it is the set of interfaces the repo actually declares.
 * A hardcoded list would put domain nouns (`ICourse` is LMS, `IBlock` is CMS) inside archor, which is a
 * standalone package that must hold no domain or plugin knowledge — and it would rot the moment an
 * interface is added or renamed. Declaring an interface is what puts its name under this rule.
 *
 * Ratcheted per area: the count may fall, never rise.
 */
export class LeakedInterfaceCopyGuard {
  /** `export interface IFoo` / `interface IFoo` — the declaration that defines the vocabulary. */
  private static readonly DECLARATION = /^\s*(?:export\s+)?interface\s+(I[A-Z][A-Za-z0-9]*)\b/gm;

  /** A quoted string literal. */
  private static readonly LITERAL = /'([^'\\\n]|\\.)*'|"([^"\\\n]|\\.)*"|`([^`\\]|\\.)*`/g;

  /** JSX text: a run between `>` and `<`/`{` with no braces or angles — i.e. rendered prose. */
  private static readonly JSX_TEXT = /(?<=>)([^<>{}]+)(?=[<{])/g;

  /** Comments (incl. the `/**` opener), imports and declarations may name an interface freely. */
  private static readonly SKIP_LINE = /^\s*(\/\*|\*|\/\/|import|export\s+(type|interface)|interface\s)/;

  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git', 'ui-ssr',
  ]);

  static readonly BASELINE: Readonly<Record<string, number>> = {
    plugins: 0, themes: 0, framework: 0, appearance: 0,
  };

  /** `ui`/`ui-ssr` at an extension ROOT is build output; `src/ui` is source. */
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
        if (LeakedInterfaceCopyGuard.SKIP_DIR.has(entry) || LeakedInterfaceCopyGuard.isBuildOutput(full)) continue;
        LeakedInterfaceCopyGuard.files(full, out);
      } else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  /** Every interface name the given files declare — the vocabulary this guard polices. */
  private static vocabulary(files: readonly string[]): Set<string> {
    const names = new Set<string>();
    for (const file of files) {
      let source: string;
      try { source = readFileSync(file, 'utf8'); } catch { continue; }
      if (!source.includes('interface ')) continue;
      LeakedInterfaceCopyGuard.DECLARATION.lastIndex = 0;
      for (const match of source.matchAll(LeakedInterfaceCopyGuard.DECLARATION)) names.add(match[1]);
    }
    return names;
  }

  static violationsIn(file: string, vocabulary: ReadonlySet<string>, wordRe: RegExp): string[] {
    let source: string;
    try { source = readFileSync(file, 'utf8'); } catch { return []; }
    // JSX text only exists in `.tsx`. In a `.ts` the same `>` ... `<` shape is a GENERIC parameter
    // (`Promise<IPluginHealthProbeResult | Promise<...>>`), which is a type position, not copy.
    const patterns = /\.tsx$/.test(file)
      ? [LeakedInterfaceCopyGuard.LITERAL, LeakedInterfaceCopyGuard.JSX_TEXT]
      : [LeakedInterfaceCopyGuard.LITERAL];
    const hits: string[] = [];
    source.split('\n').forEach((line, index) => {
      if (LeakedInterfaceCopyGuard.SKIP_LINE.test(line)) return;
      for (const rx of patterns) {
        rx.lastIndex = 0;
        for (const span of line.match(rx) ?? []) {
          // A span carrying type syntax is an annotation the loose JSX pattern caught, not prose.
          if (/[:;=|&<>]|=>|\[\]|\bas\s/.test(span)) continue;
          wordRe.lastIndex = 0;
          const found = span.match(wordRe)?.filter((word) => vocabulary.has(word)) ?? [];
          if (found.length) hits.push(`${index + 1}: ${span.trim().slice(0, 70)}`);
        }
      }
    });
    return hits;
  }

  static scan(roots: readonly { area: string; dir: string }[]): {
    counts: Record<string, number>;
    detail: { area: string; file: string; hits: string[] }[];
  } {
    const byArea = roots.map(({ area, dir }) => ({ area, files: LeakedInterfaceCopyGuard.files(dir) }));
    // One vocabulary for the whole workspace: an interface declared in the framework is just as wrong
    // in a plugin's copy as in its own.
    const vocabulary = LeakedInterfaceCopyGuard.vocabulary(byArea.flatMap((entry) => entry.files));
    const wordRe = /\bI[A-Z][A-Za-z0-9]*\b/g;

    const counts: Record<string, number> = {};
    const detail: { area: string; file: string; hits: string[] }[] = [];
    for (const { area, files } of byArea) {
      counts[area] = counts[area] ?? 0;
      for (const file of files) {
        const hits = LeakedInterfaceCopyGuard.violationsIn(file, vocabulary, wordRe);
        if (!hits.length) continue;
        counts[area] += hits.length;
        detail.push({ area, file, hits });
      }
    }
    return { counts, detail };
  }
}
