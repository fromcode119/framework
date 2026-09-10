import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Remove `import React from 'react'` where the `React` binding is never referenced.
 *
 * Only safe because every bundle that consumes these files now builds with `--jsx=automatic`
 * (`PLUGIN_UI_BUILD_OPTS`, `build-appearances.sh`, the theme Vite React plugin), which compiles JSX to
 * `react/jsx-runtime` calls instead of `React.createElement`. Under the older `--jsx=transform` the
 * import was load-bearing and removing it threw "React is not defined" at RENDER — invisible to tsc,
 * esbuild and every gate. If a build is ever moved back to `transform`, this tool must not be run.
 *
 * Whether the binding is used is decided by the language service, not by scanning text: a `React` inside
 * a comment, a string or a JSX attribute name must not count, and that is precisely the mistake that has
 * broken this tree before. The named specifiers of a mixed import (`import React, { useMemo }`) are kept.
 */
export class ReactDefaultImportPrune {
  private static readonly SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.git', 'coverage']);

  static walk(dir: string): string[] {
    const out: string[] = [];
    const visit = (current: string) => {
      for (const entry of readdirSync(current)) {
        if (ReactDefaultImportPrune.SKIP_DIRS.has(entry)) continue;
        const full = path.join(current, entry);
        if (statSync(full).isDirectory()) visit(full);
        else if (/\.tsx?$/.test(full) && !full.endsWith('.d.ts')) out.push(full);
      }
    };
    visit(dir);
    return out;
  }

  /** Prune one file. Returns true when it was (or would be) changed. */
  static runFile(file: string, apply: boolean): boolean {
    const original = readFileSync(file, 'utf8');
    if (!/^\s*import\s+React\b/m.test(original)) return false;
    const source = ts.createSourceFile(file, original, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);

    let decl: ts.ImportDeclaration | undefined;
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      const spec = statement.moduleSpecifier;
      if (!ts.isStringLiteral(spec) || spec.text !== 'react') continue;
      const clause = statement.importClause;
      if (!clause?.name || clause.name.text !== 'React') continue;
      if (clause.isTypeOnly) continue;
      decl = statement;
      break;
    }
    if (!decl?.importClause?.name) return false;

    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => [file],
      getScriptVersion: () => '0',
      getScriptSnapshot: (f) => (f === file ? ts.ScriptSnapshot.fromString(original) : undefined),
      getCurrentDirectory: () => path.dirname(file),
      getCompilationSettings: () => ({ jsx: ts.JsxEmit.ReactJSX, allowJs: true, noEmit: true, target: ts.ScriptTarget.ESNext }),
      getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
      fileExists: (f) => f === file,
      readFile: (f) => (f === file ? original : undefined),
    };
    const service = ts.createLanguageService(host, ts.createDocumentRegistry());
    const binding = decl.importClause.name;
    const locations = service.findRenameLocations(file, binding.getStart(source), false, false, {}) ?? [];
    // the declaration site itself is the only permitted occurrence
    const used = locations.some((loc) => loc.textSpan.start !== binding.getStart(source));
    if (used) return false;

    const named = decl.importClause.namedBindings;
    let replacement: string;
    if (named && ts.isNamedImports(named) && named.elements.length) {
      const kind = decl.importClause.isTypeOnly ? 'import type' : 'import';
      replacement = `${kind} { ${named.elements.map((e) => e.getText(source)).join(', ')} } from 'react';`;
    } else if (named && ts.isNamespaceImport(named)) {
      return false; // `import React, * as X` — leave it alone
    } else {
      replacement = '';
    }

    let start = decl.getStart(source);
    let end = decl.getEnd();
    if (!replacement && original[end] === '\n') end += 1;
    if (!replacement) {
      // also swallow the line's leading indentation
      while (start > 0 && (original[start - 1] === ' ' || original[start - 1] === '\t')) start -= 1;
    }
    const text = original.slice(0, start) + replacement + original.slice(end);
    if (apply) writeFileSync(file, text, 'utf8');
    return true;
  }

  static run(dir: string, apply: boolean): string[] {
    return ReactDefaultImportPrune.walk(dir).filter((f) => ReactDefaultImportPrune.runFile(f, apply));
  }
}
