import path from 'node:path';
import ts from 'typescript';
import { ComponentClassAnalyzer } from './component-class-analyzer';

/**
 * The source-TEXT edits of the component migration: adding the imports a moved type needs, turning a
 * functional setState into field assignments, and importing the decorators that were emitted.
 *
 * Split out of ComponentDecoratorMigration (765 lines) 2026-09-09. Everything here takes source text
 * and returns source text; the decisions were already made by the analyzers.
 */
export class ComponentSourceRewriter {
  /**
   * Adds a type-only import for every name a moved member's type mentions that the target file does not
   * already have. An absolute specifier (the type was declared in, or imported relatively by, another
   * file) is re-based against the target's directory; a package/alias specifier is used verbatim.
   */
  static ensureTypeImports(source: string, file: string, carried: Map<string, string>): string {
    // An import list can span lines, so "already imported?" is asked against the WHOLE import statement,
    // not a single line — a line-anchored test re-imported a name that was already there two lines up.
    const statements = [...source.matchAll(/import[\s\S]*?from\s*['"][^'"]+['"];/g)].map((m) => m[0]);
    const additions: string[] = [];
    for (const [name, encoded] of carried) {
      const [exported, spec] = encoded.split('\u0000');
      if (statements.some((stmt) => new RegExp(`\\b${name}\\b`).test(stmt))) continue;
      if (!new RegExp(`\\b${name}\\b`).test(source)) continue;
      let module = spec;
      if (path.isAbsolute(spec)) {
        if (path.resolve(spec).replace(/\.tsx?$/, '') === file.replace(/\.tsx?$/, '')) continue;
        const rel = path.relative(path.dirname(file), spec).replace(/\.tsx?$/, '');
        module = rel.startsWith('.') ? rel : `./${rel}`;
      }
      additions.push(exported === name
        ? `import type { ${name} } from '${module}';`
        : `import type { ${exported} as ${name} } from '${module}';`);
    }
    if (!additions.length) return source;
    // after the last existing import, so the file keeps one contiguous import block
    const imports = [...source.matchAll(/import[\s\S]*?from\s*['"][^'"]+['"];/g)];
    const last = imports[imports.length - 1];
    if (!last) return `${additions.join('\n')}\n${source}`;
    const at = (last.index ?? 0) + last[0].length;
    return `${source.slice(0, at)}\n${additions.join('\n')}${source.slice(at)}`;
  }


  /**
   * Rewrite every simple functional `setState` into direct field assignments.
   *
   * `this.setState((p) => ({ a: p.a + 1, b: true }))` becomes `this.a = this.a + 1; this.b = true;` —
   * with `@state` the assignment IS the update, and reading `this.a` inside it reads the current value,
   * which is exactly what the updater's parameter gave.
   */
  static rewriteFunctionalSetState(source: string, file: string): string {
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const edits: Array<{ start: number; end: number; replacement: string }> = [];
    const visit = (node: ts.Node): void => {
      if (ComponentClassAnalyzer.functionalSetState(node) && ComponentClassAnalyzer.simpleUpdater(node)) {
        const fn = node.arguments[0] as ts.ArrowFunction;
        const paramName = (fn.parameters[0].name as ts.Identifier).text;
        const body = (ts.isParenthesizedExpression(fn.body) ? fn.body.expression : fn.body) as ts.ObjectLiteralExpression;
        const assignments = body.properties.map((prop) => {
          const assignment = prop as ts.PropertyAssignment;
          const name = (assignment.name as ts.Identifier).text;
          // `prev.x` inside the updater is the CURRENT value, which `this.x` reads.
          const value = assignment.initializer.getText(parsed)
            .replace(new RegExp(`\\b${paramName}\\.`, 'g'), 'this.');
          return `this.${name} = ${value};`;
        });
        // A single assignment can stay an expression (it may sit in an arrow body); several need a block.
        const replacement = assignments.length === 1
          ? assignments[0].replace(/;$/, '')
          : `{ ${assignments.join(' ')} }`;
        edits.push({ start: node.getStart(parsed), end: node.end, replacement });
        return;
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(parsed, visit);
    if (!edits.length) return source;
    let out = source;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end);
    }
    return out;
  }


  /** Adds `prop`/`state` to the existing reactor/sdk import, or a new import when there is none. */
  /**
   * Add the decorator import, from the RIGHT package for where the file lives.
   *
   * Framework packages import `@fromcode119/reactor` directly. A PLUGIN, THEME or APPEARANCE bundle must
   * take them from `@fromcode119/sdk/react` instead — reactor is republished through the SDK bridge, and
   * a bare `@fromcode119/reactor` specifier is not externalised for those builds: Rollup fails with
   * "failed to resolve import" and the whole theme build dies.
   */
  static ensureDecoratorImport(source: string, file = ''): string {
    const needed = ['prop', 'state', 'watch'].filter((d) => new RegExp(`@${d}[\\s(]`).test(source));
    if (!needed.length) return source;
    const existing = /^import \{([^}]*)\} from '(@fromcode119\/(?:reactor|sdk\/react))';$/m.exec(source);
    if (existing) {
      const have = existing[1].split(',').map((x) => x.trim()).filter(Boolean);
      const merged = [...new Set([...have, ...needed])].sort();
      if (merged.length === have.length) return source;
      return source.slice(0, existing.index)
        + `import { ${merged.join(', ')} } from '${existing[2]}';`
        + source.slice(existing.index + existing[0].length);
    }
    const outsideFramework = /[\\/](plugins|themes|appearance)[\\/]/.test(file);
    const from = outsideFramework ? '@fromcode119/sdk/react' : '@fromcode119/reactor';
    return `import { ${needed.join(', ')} } from '${from}';\n${source}`;
  }
}
