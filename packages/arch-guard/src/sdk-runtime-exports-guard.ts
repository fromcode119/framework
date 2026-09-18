import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { ISdkRuntimeExportOffender } from './interfaces/sdk-runtime-export-offender.interface';

/**
 * An extension may only import from `@fromcode119/sdk` what the RUNTIME import map actually provides.
 *
 * `SdkExportSourceBuilder.SDK_EXPORT_KEYS` is a hand-maintained list, and it IS the browser's import
 * map for `@fromcode119/sdk`: the framework generates a data-URL module with exactly those exports and
 * registers it under that specifier. A bundle importing a name that is not on the list does not lose
 * one symbol — it fails to LOAD:
 *
 *     SyntaxError: The requested module '@fromcode119/sdk' does not provide an export named 'X'
 *
 * and the whole plugin is gone. No banner, no island, no error anywhere but one line in the browser
 * console. Nothing else can see it: the plugin type-checks, because the SDK PACKAGE exports the name;
 * it is the runtime map that does not, and no compiler reads that map.
 *
 * This cost two releases on 2026-09-18. `IBrowserCookieOptions.sameSite` is typed as `CookieSameSite`,
 * so privacy's consent store and mlm's referral store both import the enum as a value; it was missing
 * from the list, and both plugins shipped with dead storefront bundles.
 *
 * TWO LISTS, not one. The generated module reads each key off the runtime bridge object, so a name on
 * `SDK_EXPORT_KEYS` but absent from `BridgeObjectBuilder` exports `undefined` — which trades the load
 * error for a TypeError at first use, later and harder to place. Both are checked here.
 *
 * WHY SOURCE AND NOT THE BUNDLES. Reading the built `frontend.js` / `bundle.js` import specifiers
 * would be exact, but those are gitignored build output: in a fresh CI checkout there is nothing to
 * read, and a guard that silently scans an empty set is indistinguishable from a clean one. So this
 * reads source — which means it has to tell a VALUE import from a type one, because `import type` and
 * a name used only in a type position are both erased by esbuild and reach no import map. That
 * distinction is not cosmetic: ecommerce imports `MeasurementSystem`, which is NOT on the list and is
 * NOT a defect, because every use of it is a type annotation.
 */
export class SdkRuntimeExportsGuard {
  private static readonly SPECIFIER = '@fromcode119/sdk';

  /** Where the two lists that must agree live, relative to the framework root. */
  private static readonly EXPORT_KEYS_FILE = 'packages/react/src/helpers/sdk-export-source-builder.ts';
  private static readonly BRIDGE_FILE = 'packages/react/src/helpers/bridge-object-builder.ts';

  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git', 'tests', '__tests__',
  ]);

  private static parse(file: string): ts.SourceFile {
    return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  }

  /**
   * The names the import map publishes — the string literals of `SDK_EXPORT_KEYS`.
   *
   * Read from the AST rather than matched with a regex: the property is the guard's whole subject, and
   * a pattern that quietly matched nothing would make every extension look clean.
   */
  static publishedNames(framework: string): Set<string> {
    const file = path.join(framework, SdkRuntimeExportsGuard.EXPORT_KEYS_FILE);
    const names = new Set<string>();
    if (!existsSync(file)) return names;
    const source = SdkRuntimeExportsGuard.parse(file);

    const visit = (node: ts.Node): void => {
      if (ts.isPropertyDeclaration(node)
        && ts.isIdentifier(node.name)
        && node.name.text === 'SDK_EXPORT_KEYS'
        && node.initializer) {
        const array = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
        if (ts.isArrayLiteralExpression(array)) {
          for (const element of array.elements) {
            if (ts.isStringLiteralLike(element)) names.add(element.text);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return names;
  }

  /**
   * The names the runtime bridge object actually carries — every shorthand or named property of the
   * object literal the builder returns.
   */
  static bridgeNames(framework: string): Set<string> {
    const file = path.join(framework, SdkRuntimeExportsGuard.BRIDGE_FILE);
    const names = new Set<string>();
    if (!existsSync(file)) return names;
    const source = SdkRuntimeExportsGuard.parse(file);

    const visit = (node: ts.Node): void => {
      if (ts.isObjectLiteralExpression(node)) {
        for (const property of node.properties) {
          if (ts.isShorthandPropertyAssignment(property)) names.add(property.name.text);
          else if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) names.add(property.name.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return names;
  }

  /** Is this identifier inside a type annotation, and therefore erased before any bundle sees it? */
  private static inTypePosition(node: ts.Node): boolean {
    for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
      if (ts.isTypeNode(current) || ts.isTypeAliasDeclaration(current) || ts.isInterfaceDeclaration(current)) return true;
      // The value half of `typeof X` IS a value reference at runtime for a bundler's purposes only in
      // a type query — which is erased. Treat it as a type.
      if (ts.isTypeQueryNode(current)) return true;
      if (ts.isImportDeclaration(current)) return true;
    }
    return false;
  }

  /**
   * The names this file imports from the SDK as VALUES — the ones that must resolve at runtime.
   *
   * Skipped: `import type { … }`, an individual `type X` specifier, and any name every occurrence of
   * which sits in a type position. Each is erased, so none reaches the import map.
   */
  static valueImports(file: string): string[] {
    const source = SdkRuntimeExportsGuard.parse(file);
    const candidates = new Map<string, string>();

    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      if (!ts.isStringLiteralLike(statement.moduleSpecifier)) continue;
      if (statement.moduleSpecifier.text !== SdkRuntimeExportsGuard.SPECIFIER) continue;
      const clause = statement.importClause;
      if (!clause || clause.isTypeOnly || !clause.namedBindings) continue;
      if (!ts.isNamedImports(clause.namedBindings)) continue;
      for (const element of clause.namedBindings.elements) {
        if (element.isTypeOnly) continue;
        // `local` is what the file refers to it by; the reported name is what the map must publish.
        candidates.set(element.name.text, (element.propertyName ?? element.name).text);
      }
    }
    if (!candidates.size) return [];

    const used = new Set<string>();
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && candidates.has(node.text) && !SdkRuntimeExportsGuard.inTypePosition(node)) {
        used.add(candidates.get(node.text) as string);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return [...used];
  }

  /** Every authored source file under an extension's `src/ui`. */
  private static uiSources(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const entry of entries) {
      if (SdkRuntimeExportsGuard.SKIP_DIR.has(entry)) continue;
      const full = path.join(dir, entry);
      if (statSync(full, { throwIfNoEntry: false })?.isDirectory()) SdkRuntimeExportsGuard.uiSources(full, out);
      else if (/\.tsx?$/.test(full) && !full.endsWith('.d.ts')) out.push(full);
    }
    return out;
  }

  /** Every extension UI file importing an SDK name the runtime cannot provide. */
  static scan(framework: string, roots: readonly { area: string; dir: string }[]): ISdkRuntimeExportOffender[] {
    const published = SdkRuntimeExportsGuard.publishedNames(framework);
    if (!published.size) {
      throw new Error(`[arch-guard] SDK_EXPORT_KEYS could not be read from ${SdkRuntimeExportsGuard.EXPORT_KEYS_FILE}.`);
    }

    const offenders: ISdkRuntimeExportOffender[] = [];
    for (const { dir } of roots) {
      let slugs: string[];
      try { slugs = readdirSync(dir); } catch { continue; }
      for (const slug of slugs) {
        const ui = path.join(dir, slug, 'src', 'ui');
        if (!statSync(ui, { throwIfNoEntry: false })?.isDirectory()) continue;
        for (const file of SdkRuntimeExportsGuard.uiSources(ui)) {
          const missing = SdkRuntimeExportsGuard.valueImports(file).filter((name) => !published.has(name));
          if (missing.length) offenders.push({ file, names: missing.sort() });
        }
      }
    }
    return offenders;
  }

  /**
   * Names the import map publishes that the bridge object does not carry.
   *
   * The generated module reads every key off that object, so one of these exports `undefined` — the
   * import succeeds and the first use throws instead.
   */
  static unbackedNames(framework: string): string[] {
    const bridge = SdkRuntimeExportsGuard.bridgeNames(framework);
    if (!bridge.size) return [];
    return [...SdkRuntimeExportsGuard.publishedNames(framework)].filter((name) => !bridge.has(name)).sort();
  }
}
