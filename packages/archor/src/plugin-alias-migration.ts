import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Rewrites a plugin's RELATIVE in-package imports to its `@plugin/` alias.
 *
 * Every plugin is its own repository, so — exactly like a theme's `@theme/` — each one spells its own
 * source root the same way: `@plugin/` resolves to `plugins/<slug>/src`. One spelling for all 25 plugins,
 * so a module is named by where it LIVES and the specifier does not change when a file moves.
 *
 * `@plugin/` is safe despite `context.db.find('@plugin/entity')`: DB table names are semantic strings in
 * ARGUMENT position and always name a real slug (`@forms/list`), never the literal `plugin`. This tool
 * only ever touches specifiers in import/export/require/mock position.
 *
 * Only a specifier that resolves INSIDE `src` is rewritten. A root file importing `./manifest.json`, or a
 * test importing a sibling helper in `tests/`, has no alias to use and stays relative — rewriting those
 * would produce a specifier that resolves nowhere.
 */
export class PluginAliasMigration {
  static readonly ALIAS = '@plugin/';

  private static readonly SKIP = new Set(['node_modules', 'dist', '.next', 'build', 'coverage', '.git']);

  /**
   * BUILD OUTPUT, and only at the plugin ROOT. `<plugin>/ui` and `<plugin>/ui-ssr` hold generated
   * bundles — but `<plugin>/src/ui` is authored admin-UI source. Skipping the name at any depth (the
   * first version of this) silently passed over every `src/ui` file, so the largest UI trees would have
   * been left half-converted with no error anywhere.
   */
  private static readonly SKIP_AT_ROOT = new Set(['ui', 'ui-ssr']);

  private static readonly EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.less', '.mjs'];

  /** Every authored `.ts`/`.tsx` in the plugin. */
  private static walk(dir: string, pluginDir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    const atRoot = path.resolve(dir) === path.resolve(pluginDir);
    for (const name of entries) {
      if (PluginAliasMigration.SKIP.has(name)) continue;
      if (atRoot && PluginAliasMigration.SKIP_AT_ROOT.has(name)) continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) PluginAliasMigration.walk(full, pluginDir, out);
      else if (/\.tsx?$/.test(full) && !full.endsWith('.d.ts')) out.push(full);
    }
    return out;
  }

  /** Absolute file a relative specifier points at, or null when nothing exists there. */
  private static resolve(spec: string, importer: string): string | null {
    const base = path.normalize(path.join(path.dirname(importer), spec));
    if (existsSync(base) && statSync(base).isFile()) return path.resolve(base);
    for (const ext of PluginAliasMigration.EXTENSIONS) {
      if (existsSync(base + ext)) return path.resolve(base + ext);
    }
    for (const index of ['/index.ts', '/index.tsx']) {
      if (existsSync(base + index)) return path.resolve(base + index);
    }
    return null;
  }

  /**
   * Specifier positions ONLY — collected from the real AST, never a regex over text, so a table name or
   * a string inside a template literal can never be mistaken for an import.
   */
  private static specifierNodes(source: ts.SourceFile): ts.StringLiteralLike[] {
    const found: ts.StringLiteralLike[] = [];
    const visit = (node: ts.Node): void => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
        && ts.isStringLiteralLike(node.moduleSpecifier)) {
        found.push(node.moduleSpecifier);
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
        && ts.isStringLiteralLike(node.argument.literal)) {
        // `planOverride?: import('./resolved-plan.interface').IResolvedPlan` — an import-TYPE node, not a
        // CallExpression. It names a module exactly like an import statement does, and missing it left
        // real relative specifiers behind after a "complete" conversion.
        found.push(node.argument.literal);
      } else if (ts.isCallExpression(node)) {
        const target = node.expression;
        const isRequire = ts.isIdentifier(target) && target.text === 'require';
        const isDynamicImport = target.kind === ts.SyntaxKind.ImportKeyword;
        const isMock = ts.isPropertyAccessExpression(target)
          && /^(vi|jest)$/.test(target.expression.getText(source))
          && target.name.text === 'mock';
        if ((isRequire || isDynamicImport || isMock) && node.arguments.length
          && ts.isStringLiteralLike(node.arguments[0])) {
          found.push(node.arguments[0] as ts.StringLiteralLike);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
  }

  /**
   * @returns one line per rewritten specifier. `apply: false` reports without writing.
   */
  static run(pluginDir: string, apply: boolean): string[] {
    // The alias root is the PLUGIN ROOT, not `src`. `settings.ts`, `seed.ts` and `index.ts` live at the
    // root, so a src-anchored alias could not name them at all and 23 imports of them stayed relative —
    // and the guard, sharing the same anchor, reported the tree clean.
    const root = path.resolve(pluginDir);
    if (!existsSync(path.join(root, 'src'))) return [];
    const changes: string[] = [];

    for (const file of PluginAliasMigration.walk(pluginDir, pluginDir)) {
      const original = readFileSync(file, 'utf8');
      const source = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true);
      // Collect edits first, then apply from the END so earlier offsets stay valid.
      const edits: Array<{ start: number; end: number; text: string }> = [];

      for (const node of PluginAliasMigration.specifierNodes(source)) {
        const spec = node.text;
        // Re-anchor specifiers written against the OLD src-rooted alias.
        if (spec.startsWith(PluginAliasMigration.ALIAS) && !spec.startsWith(`${PluginAliasMigration.ALIAS}src/`)) {
          const next = `${PluginAliasMigration.ALIAS}src/${spec.slice(PluginAliasMigration.ALIAS.length)}`;
          if (existsSync(path.join(root, next.slice(PluginAliasMigration.ALIAS.length) + '.ts'))
            || existsSync(path.join(root, next.slice(PluginAliasMigration.ALIAS.length) + '.tsx'))
            || existsSync(path.join(root, next.slice(PluginAliasMigration.ALIAS.length)))) {
            edits.push({ start: node.getStart(source) + 1, end: node.getEnd() - 1, text: next });
            changes.push(`${path.relative(pluginDir, file)}: '${spec}' -> '${next}'`);
          }
          continue;
        }
        if (!spec.startsWith('.')) continue;
        const target = PluginAliasMigration.resolve(spec, file);
        if (!target || !target.startsWith(root + path.sep)) continue;

        const withinSrc = path.relative(root, target).split(path.sep).join('/');
        // Drop the extension so the specifier keeps the shape the rest of the tree uses; an
        // `index.ts` collapses to its directory, matching how it was written relatively.
        const bare = withinSrc.replace(/\.tsx?$/, '').replace(/\/index$/, '');
        const next = `${PluginAliasMigration.ALIAS}${bare}`;
        if (next === spec) continue;

        // getStart()+1 / getEnd()-1 keeps the original quote characters untouched.
        edits.push({ start: node.getStart(source) + 1, end: node.getEnd() - 1, text: next });
        changes.push(`${path.relative(pluginDir, file)}: '${spec}' -> '${next}'`);
      }

      if (!edits.length || !apply) continue;
      let updated = original;
      for (const edit of edits.sort((a, b) => b.start - a.start)) {
        updated = updated.slice(0, edit.start) + edit.text + updated.slice(edit.end);
      }
      writeFileSync(file, updated, 'utf8');
    }
    return changes;
  }
}
