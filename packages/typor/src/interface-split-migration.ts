import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Splits a file holding SEVERAL interfaces into one file per interface under a sibling `interfaces/`
 * directory, then repoints every importer.
 *
 * One purpose per file is the rule; a `*.types.ts` bag holding four unrelated shapes is the thing it
 * exists to prevent. Each extracted file carries only the imports its own interface actually needs —
 * copying the whole original import block would create unused imports (and, for a type the interface
 * does not reference, an unresolvable one).
 *
 * Conservative: a file is left ALONE when it holds anything other than interfaces and imports (a class,
 * a const, an enum), because moving those changes more than file layout.
 *
 * The emitted sibling imports are RELATIVE. In a package that has an alias (`@/`, `@theme/`, `@ai/`)
 * the house rule wants the alias form even for a same-directory target, so run the alias conversion
 * after this — `check:imports` reports the difference.
 */
export class InterfaceSplitMigration {
  private static readonly SKIP_DIRS = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git',
  ]);

  private static walk(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const name of entries) {
      if (InterfaceSplitMigration.SKIP_DIRS.has(name)) continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) InterfaceSplitMigration.walk(full, out);
      else if (/\.tsx?$/.test(full) && !full.endsWith('.d.ts')) out.push(full);
    }
    return out;
  }

  private static kebab(name: string): string {
    return name.replace(/^I(?=[A-Z])/, '').replace(/(?<!^)(?=[A-Z])/g, '-').toLowerCase();
  }

  /** Identifiers a node mentions, so only the needed imports travel with it. */
  private static namesUsed(node: ts.Node): Set<string> {
    const used = new Set<string>();
    const visit = (n: ts.Node): void => {
      if (ts.isIdentifier(n)) used.add(n.text);
      ts.forEachChild(n, visit);
    };
    visit(node);
    return used;
  }

  /**
   * The import statements from `source` that declare any of `names`.
   *
   * `rebase` must be true for an EXTRACTED file (it lands one directory deeper, in `interfaces/`) and
   * false for the KEPT file (it does not move). Getting this wrong adds a `..` and the specifier no
   * longer resolves — which is exactly what happened when the kept file reused the rebasing path.
   */
  private static importsFor(source: ts.SourceFile, names: Set<string>, text: string, rebase = true): string[] {
    const out: string[] = [];
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
      const clause = statement.importClause;
      const kept: string[] = [];
      if (clause.name && names.has(clause.name.text)) kept.push(clause.name.text);
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          if (names.has(element.name.text)) kept.push(element.getText(source));
        }
      }
      if (!kept.length) continue;
      let spec = (statement.moduleSpecifier as ts.StringLiteral).text;
      // The extracted file lives one directory DEEPER (`interfaces/`), so a relative specifier copied
      // verbatim resolves to the wrong place — re-base it against the new location.
      if (rebase && spec.startsWith('.')) {
        const absolute = path.resolve(path.dirname(source.fileName), spec);
        const rebased = path.relative(path.join(path.dirname(source.fileName), 'interfaces'), absolute)
          .split(path.sep).join('/');
        spec = rebased.startsWith('.') ? rebased : `./${rebased}`;
      }
      const typeOnly = clause.isTypeOnly ? 'type ' : '';
      out.push(`import ${typeOnly}{ ${kept.join(', ')} } from '${spec}';`);
    }
    return out;
  }

  /** Split every eligible file under `dir`. Pass `apply: false` to preview. */
  static run(dir: string, apply = true): { split: string[]; skipped: string[] } {
    const files = InterfaceSplitMigration.walk(dir);
    const split: string[] = [];
    const skipped: string[] = [];
    // old module path (no extension) -> { interfaceName: new module path }
    const moved = new Map<string, Map<string, string>>();

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

      const interfaces = source.statements.filter(ts.isInterfaceDeclaration);
      if (interfaces.length < 2) continue;

      // A MIXED file — interfaces plus `type` aliases — is split too: the interfaces move out and the
      // aliases stay, which is the shape almost every remaining `*.types.ts` bag has. Two extra import
      // fix-ups make it safe, and both were missing on the first attempt (which produced 27 dangling
      // references): an extracted interface must import any alias it references from the KEPT file, and
      // the kept file must import back any interface ITS aliases reference.
      //
      // Anything OTHER than an interface or a type alias (a class, a const, an enum) still stops the
      // split — moving those changes more than file layout.
      const others = source.statements.filter((s) => !ts.isInterfaceDeclaration(s)
        && !ts.isImportDeclaration(s) && !ts.isTypeAliasDeclaration(s));
      if (others.length) {
        skipped.push(`${path.basename(file)}: also holds ${others.length} non-interface statement(s)`);
        continue;
      }
      const aliases = source.statements.filter(ts.isTypeAliasDeclaration);
      const aliasNames = new Set(aliases.map((a) => a.name.text));

      const dirName = path.join(path.dirname(file), 'interfaces');
      const map = new Map<string, string>();
      // Names that shared this file: an extracted interface referencing a SIBLING needs a real import
      // now that they no longer live together.
      const siblings = new Map<string, string>();
      for (const declaration of interfaces) {
        siblings.set(declaration.name.text,
          path.join(dirName, `${InterfaceSplitMigration.kebab(declaration.name.text)}.interface`));
      }
      for (const declaration of interfaces) {
        const name = declaration.name.text;
        const target = path.join(dirName, `${InterfaceSplitMigration.kebab(name)}.interface.ts`);
        const used = InterfaceSplitMigration.namesUsed(declaration);
        const needed = InterfaceSplitMigration.importsFor(source, used, text);
        for (const [sibling, modulePath] of siblings) {
          if (sibling === name || !used.has(sibling)) continue;
          needed.push(`import type { ${sibling} } from './${path.basename(modulePath)}';`);
        }
        // An alias that STAYED behind is one directory up now.
        const usedAliases = [...aliasNames].filter((alias) => used.has(alias));
        if (usedAliases.length) {
          needed.push(`import type { ${usedAliases.join(', ')} } from '../${path.basename(file).replace(/\.tsx?$/, '')}';`);
        }
        // getFullText keeps the leading JSDoc with its interface
        const body = declaration.getFullText(source).replace(/^\s*\n/, '');
        if (apply) {
          mkdirSync(dirName, { recursive: true });
          writeFileSync(target, `${needed.length ? `${needed.join('\n')}\n\n` : ''}${body.trimEnd()}\n`, 'utf8');
        }
        map.set(name, target.replace(/\.tsx?$/, ''));
      }
      moved.set(file.replace(/\.tsx?$/, ''), map);
      if (apply) {
        if (!aliases.length) {
          unlinkSync(file);
        } else {
          // Keep the aliases, and import back whichever moved interfaces they reference.
          const aliasText = aliases.map((a) => a.getFullText(source).replace(/^\s*\n/, '').trimEnd()).join('\n\n');
          const referenced = new Set<string>();
          for (const alias of aliases) {
            for (const usedName of InterfaceSplitMigration.namesUsed(alias)) {
              if (map.has(usedName)) referenced.add(usedName);
            }
          }
          const backImports = [...referenced].map((usedName) => {
            const rel = path.relative(path.dirname(file), map.get(usedName)!).split(path.sep).join('/');
            return `import type { ${usedName} } from '${rel.startsWith('.') ? rel : `./${rel}`}';`;
          });
          const kept = InterfaceSplitMigration.importsFor(
            source,
            new Set(aliases.flatMap((a) => [...InterfaceSplitMigration.namesUsed(a)])),
            text,
            false,
          );
          writeFileSync(file,
            `${[...kept, ...backImports].join('\n')}${kept.length || backImports.length ? '\n\n' : ''}${aliasText}\n`,
            'utf8');
        }
      }
      split.push(`${path.basename(file)} -> ${interfaces.length} file(s)${aliases.length ? ` (+${aliases.length} alias(es) kept)` : ''}`);
    }

    if (!apply || !moved.size) return { split, skipped };

    // repoint importers: one import statement per interface, at its new module.
    // The trailing semicolon is OPTIONAL — a codebase without a semicolon rule has both forms, and
    // requiring it silently skipped every such importer, leaving them pointing at names that had moved.
    // `export … from` as well as `import … from`: a BARREL re-exporting the moved names is just as
    // much an importer, and handling only `import` left a `export type { X } from './bag'` pointing at
    // names that had moved ("has no exported member").
    const SPEC = /(import|export)\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)';?/g;
    for (const file of InterfaceSplitMigration.walk(dir)) {
      const text = readFileSync(file, 'utf8');
      let out = text;
      out = out.replace(SPEC, (whole, keyword, typeOnly, names, spec) => {
        const terminator = whole.endsWith(';') ? ';' : '';
        const resolved = spec.startsWith('.')
          ? path.normalize(path.join(path.dirname(file), spec))
          : null;
        const map = resolved ? moved.get(resolved) : null;
        if (!map) return whole;
        const lines: string[] = [];
        const leftovers: string[] = [];
        for (const raw of names.split(',').map((n: string) => n.trim()).filter(Boolean)) {
          const bare = raw.split(/\s+as\s+/)[0].trim();
          const target = map.get(bare);
          if (!target) { leftovers.push(raw); continue; }
          let rel = path.relative(path.dirname(file), target).split(path.sep).join('/');
          if (!rel.startsWith('.')) rel = `./${rel}`;
          lines.push(`${keyword} ${typeOnly ?? ''}{ ${raw} } from '${rel}'${terminator}`);
        }
        if (leftovers.length) lines.unshift(`${keyword} ${typeOnly ?? ''}{ ${leftovers.join(', ')} } from '${spec}'${terminator}`);
        return lines.join('\n');
      });
      if (out !== text) writeFileSync(file, out, 'utf8');
    }
    return { split, skipped };
  }
}
