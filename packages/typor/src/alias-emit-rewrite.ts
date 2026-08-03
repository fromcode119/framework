import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Lets a library package import its own source through an alias (`@ai/enums/agent-role.enum`) while the
 * COMPILED output still uses plain relative paths.
 *
 * Why this exists. A framework package is built by `tsc` and run by Node, and `tsc` never rewrites
 * `paths` on emit — so an alias written in source survives verbatim into `dist`, where Node cannot
 * resolve it. Node's own `imports` map (`#foo`) would work at runtime, but it requires
 * `moduleResolution: node16` across every consumer (a package's emitted `.d.ts` keeps the `#` specifier),
 * and flipping this workspace to node16 produced 166 errors in `core` alone — 69 of them real CJS/ESM
 * interop breakage. That is a module-system migration, not an import-style fix.
 *
 * So the alias is resolved at BUILD time, the same way nextor generates Next's route exports and
 * `TyporSyntaxPlugin` rewrites extended syntax: `typor-build` swaps alias specifiers for relative ones,
 * runs `tsc`, and restores the sources in a `finally`. Emitted `.js`/`.d.ts` contain only relative
 * paths, so consumers, Node, and the Docker build see exactly what they saw before.
 *
 * The alias map is read from the package's own `tsconfig.json` `paths`, so the editor and
 * `tsc --noEmit` resolve it directly and there is one source of truth.
 */
export class AliasEmitRewrite {
  /** Matches the specifier in `from '…'`, `import('…')` and `require('…')`. */
  private static readonly SPECIFIER = /((?:from|import|require)\s*\(?\s*)(['"])([^'"]+)\2/g;

  /**
   * The `paths` entries of a package's tsconfig that point INTO that package, as
   * `{ prefix: '@ai/', root: '<abs>/src' }`. Only `<alias>/*` → `<dir>/*` shapes are eligible.
   */
  static aliasesOf(packageDir: string): Array<{ prefix: string; root: string }> {
    const configPath = path.join(packageDir, 'tsconfig.json');
    if (!existsSync(configPath)) return [];
    // Parsed by TypeScript itself, never by hand. A tsconfig is JSONC, and stripping its comments with
    // a regex corrupts it: `/*` inside the path pattern `"@ai/*"` opened a block comment that closed on
    // the `*/` inside the include glob `"src/**/*"`, swallowing the paths map in between.
    const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => undefined,
    } as ts.ParseConfigFileHost);
    const paths = parsed?.options?.paths;
    if (!paths) return [];

    // A package also maps its OWN published name at its source (`@fromcode119/core/*` → `core/src/*`) so
    // its internal self-references type-check. Those are REAL specifiers that Node resolves through
    // node_modules, and they are already in the emitted output today — rewriting them would change
    // working emit. Only a private alias (one that is not a package name) is resolved here.
    const scope = `@${(AliasEmitRewrite.packageName(packageDir) ?? '/').split('/')[0].replace(/^@/, '')}/`;

    const out: Array<{ prefix: string; root: string }> = [];
    for (const [pattern, targets] of Object.entries(paths)) {
      const target = targets?.[0];
      if (!pattern.endsWith('/*') || !target?.endsWith('/*')) continue;
      if (pattern.startsWith(scope)) continue;
      const root = path.resolve(parsed.options.baseUrl ?? packageDir, target.slice(0, -2));
      // Only aliases that stay inside this package — a cross-package alias is a boundary violation and
      // must not be silently rewritten into a relative path that climbs out of the package.
      if (!root.startsWith(path.resolve(packageDir) + path.sep)) continue;
      out.push({ prefix: pattern.slice(0, -1), root });
    }
    return out;
  }

  /** The `name` field of a package, or null when it has none. */
  private static packageName(packageDir: string): string | null {
    const manifest = path.join(packageDir, 'package.json');
    if (!existsSync(manifest)) return null;
    try { return JSON.parse(readFileSync(manifest, 'utf8'))?.name ?? null; } catch { return null; }
  }

  /** True when the source names any of these aliases at all. */
  static handles(source: string, aliases: Array<{ prefix: string; root: string }>): boolean {
    return aliases.some((alias) => source.includes(alias.prefix));
  }

  /**
   * Rewrite every alias specifier in `source` to a path relative to `file`.
   * Line- and column-preserving is not possible here (paths differ in length), but only the specifier
   * text changes, so line NUMBERS are preserved and diagnostics stay accurate.
   */
  static transform(source: string, file: string, aliases: Array<{ prefix: string; root: string }>): string {
    return source.replace(AliasEmitRewrite.SPECIFIER, (match, lead, quote, spec) => {
      const alias = aliases.find((candidate) => spec.startsWith(candidate.prefix));
      if (!alias) return match;
      const absolute = path.join(alias.root, spec.slice(alias.prefix.length));
      let relative = path.relative(path.dirname(file), absolute).split(path.sep).join('/');
      if (!relative.startsWith('.')) relative = `./${relative}`;
      return `${lead}${quote}${relative}${quote}`;
    });
  }
}
