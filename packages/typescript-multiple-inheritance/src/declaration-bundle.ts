import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Makes a package's emitted `.d.ts` SELF-CONTAINED.
 *
 * Why this exists. A facade package re-exports its surface from other packages
 * (`export * from '@other/components'`). `tsc` never rewrites a specifier on emit, so the shipped
 * `.d.ts` says the same thing — and a consumer that installed only the facade cannot resolve it. The
 * failure is SILENT in the worst possible way: `skipLibCheck` suppresses the error inside the `.d.ts`,
 * the re-export contributes nothing, and the consumer sees "has no exported member 'X'" — or, if it
 * never type-checks at all, sees nothing and ships a call to a method that no longer exists.
 *
 * A forwarded target may not even be resolvable by anyone else: raw TypeScript inside an application,
 * written against that application's own `paths` alias. No consumer can compile it, ever.
 *
 * So the declarations are bundled at BUILD time. A dedicated "declaration project" emits real `.d.ts`
 * for every forwarded entry into `<outDir>`, rooted so all of them land in one self-consistent tree.
 * This class then does the two rewrites `tsc` will not:
 *
 *   1. inside that tree — every specifier the project's `paths` map resolves to a file INSIDE the
 *      tree becomes a relative path;
 *   2. inside the package's own `dist` — the same, so the facade's `.d.ts` point at the bundle.
 *
 * A specifier the `paths` map does not claim (`react`, `express`, a real dependency) is left alone:
 * those resolve for the consumer through normal package resolution, which is the whole point.
 *
 * Generic by construction — it reads the declaration project's OWN tsconfig for the alias map, the
 * root and the output directory, so there is one source of truth and nothing is restated here.
 */
export class DeclarationBundle {
  /** Matches the specifier in `from '…'`, `import('…')` and `require('…')` — same shape AliasEmitRewrite uses. */
  private static readonly SPECIFIER = /((?:from|import|require)\s*\(?\s*)(['"])([^'"]+)\2/g;

  /** Extensions a `paths` target may omit, longest-specific first. */
  private static readonly SOURCE_EXTENSIONS = ['.tsx', '.ts', '.d.ts', '.jsx', '.js'];

  /**
   * Rewrite `treeDir` (the emitted bundle) and `distDir` (the package's own declarations) so every
   * specifier that belongs to the bundle is relative to it. Returns how many files changed.
   */
  static apply(project: string, distDir: string, treeDir: string, rootDir: string): number {
    const map = DeclarationBundle.aliasesOf(project);
    if (!map.length) throw new Error(`[declaration-bundle] ${project} declares no "paths" — nothing to bundle.`);

    const files = [
      ...DeclarationBundle.declarations(treeDir),
      ...DeclarationBundle.declarations(distDir).filter((file) => !file.startsWith(treeDir + path.sep)),
    ];

    let changed = 0;
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const next = DeclarationBundle.rewrite(source, file, map, treeDir, rootDir);
      if (next === source) continue;
      writeFileSync(file, next, 'utf8');
      changed += 1;
    }
    return changed;
  }

  /**
   * The project's `paths` as `{ pattern, target }` with ABSOLUTE targets, longest pattern first so
   * `@fromcode119/core/client` wins over `@fromcode119/core/*`. Both shapes are kept: a `/*` pattern
   * (prefix match) and an exact one.
   */
  static aliasesOf(project: string): Array<{ pattern: string; target: string; prefix: boolean }> {
    // Parsed by TypeScript itself, never by hand — a tsconfig is JSONC and the path patterns contain
    // `/*`, which a regex comment-stripper reads as an opening block comment.
    const parsed = ts.getParsedCommandLineOfConfigFile(project, {}, {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => undefined,
    } as ts.ParseConfigFileHost);
    const paths = parsed?.options?.paths;
    if (!paths) return [];

    const base = parsed?.options?.baseUrl ?? path.dirname(project);
    const out: Array<{ pattern: string; target: string; prefix: boolean }> = [];
    for (const [pattern, targets] of Object.entries(paths)) {
      const target = targets?.[0];
      if (!target) continue;
      const prefix = pattern.endsWith('/*') && target.endsWith('/*');
      out.push({
        pattern: prefix ? pattern.slice(0, -1) : pattern,
        target: path.resolve(base, prefix ? target.slice(0, -2) : target),
        prefix,
      });
    }
    return out.sort((a, b) => b.pattern.length - a.pattern.length);
  }

  /** Rewrite every bundled specifier in one declaration file. */
  private static rewrite(
    source: string,
    file: string,
    map: Array<{ pattern: string; target: string; prefix: boolean }>,
    treeDir: string,
    rootDir: string,
  ): string {
    return source.replace(DeclarationBundle.SPECIFIER, (match, lead, quote, spec) => {
      const resolved = DeclarationBundle.resolve(spec, map);
      if (!resolved) return match;
      // Only what the bundle actually emitted. A `paths` entry pointing outside the root belongs to a
      // real dependency the consumer resolves itself — rewriting it would break that.
      if (!resolved.startsWith(rootDir + path.sep)) return match;

      const emitted = path.join(treeDir, path.relative(rootDir, resolved));
      let relative = path.relative(path.dirname(file), emitted).split(path.sep).join('/');
      if (!relative.startsWith('.')) relative = `./${relative}`;
      return `${lead}${quote}${relative}${quote}`;
    });
  }

  /**
   * The absolute, EXTENSIONLESS source path a specifier maps to, or null when no `paths` entry claims
   * it. Extensionless because the emitted twin is `<same path>.d.ts` and a declaration specifier never
   * carries an extension.
   */
  private static resolve(
    spec: string,
    map: Array<{ pattern: string; target: string; prefix: boolean }>,
  ): string | null {
    if (spec.startsWith('.') || spec.startsWith('/')) return null;

    for (const alias of map) {
      if (alias.prefix) {
        if (!spec.startsWith(alias.pattern)) continue;
        return DeclarationBundle.strip(path.join(alias.target, spec.slice(alias.pattern.length)));
      }
      if (spec === alias.pattern) return DeclarationBundle.strip(alias.target);
    }
    return null;
  }

  /**
   * Drop the extension a `paths` target may carry (`…/client.ts`), and resolve a directory target to
   * its `index` — the emitted tree mirrors the source tree, so `<dir>/index.d.ts` is what lands there.
   */
  private static strip(target: string): string {
    for (const ext of DeclarationBundle.SOURCE_EXTENSIONS) {
      if (target.endsWith(ext)) return target.slice(0, -ext.length);
    }
    // A bare path is either a file whose extension was omitted or a directory. Only the directory case
    // needs the `/index` suffix; probing the filesystem is what tells them apart.
    if (existsSync(target) && statSync(target).isDirectory()) return path.join(target, 'index');
    return target;
  }

  /** Every `.d.ts` under `dir`, or an empty list when it does not exist. */
  private static declarations(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const name of entries) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) DeclarationBundle.declarations(full, out);
      else if (full.endsWith('.d.ts')) out.push(full);
    }
    return out;
  }
}
