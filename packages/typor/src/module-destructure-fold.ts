import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Fold a module-level destructuring declaration into member access on its source.
 *
 *   const { Folder, Close: X } = FrameworkIcons;   ->  (declaration deleted)
 *   <Folder />  <X />                              ->  <FrameworkIcons.Folder />  <FrameworkIcons.Close />
 *
 * Why this needs an AST and not a regex: the bound names are ordinary identifiers — `List`, `Grid`,
 * `File`, `Media`, `X`, `Box` — that also occur in the same files as JSX tags, imported symbols and
 * locals. A blind rename is the codemod class that has corrupted this tree three times. Each binding's
 * references come from the language service, which knows the difference.
 *
 * Only declarations whose initialiser is a plain reference (`FrameworkIcons`, `A.B`) are folded; anything
 * with a call, a default value or a cast is reported and left alone, because folding it would change
 * evaluation. The `moduleDecl` guard bucket matches `const X =` and never saw these binding PATTERNS,
 * which is how 25 of them accumulated while the framework counter read zero.
 */
export class ModuleDestructureFold {
  private static readonly SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.git', 'coverage']);

  static walk(dir: string): string[] {
    const out: string[] = [];
    const visit = (current: string) => {
      for (const entry of readdirSync(current)) {
        if (ModuleDestructureFold.SKIP_DIRS.has(entry)) continue;
        const full = path.join(current, entry);
        if (statSync(full).isDirectory()) visit(full);
        else if (/\.tsx?$/.test(full) && !full.endsWith('.d.ts')) out.push(full);
      }
    };
    visit(dir);
    return out;
  }

  /** Text of an initialiser when it is a bare reference chain (`A` or `A.B`), else null. */
  private static plainSource(init: ts.Expression, source: ts.SourceFile): string | null {
    if (ts.isIdentifier(init)) return init.text;
    if (ts.isPropertyAccessExpression(init)) {
      const base = ModuleDestructureFold.plainSource(init.expression, source);
      return base ? `${base}.${init.name.text}` : null;
    }
    return null;
  }

  /** Fold every foldable module-level destructuring in one file. Returns a report line per file. */
  static runFile(file: string, apply: boolean): { folded: number; skipped: string[] } {
    const original = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, original, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
    const skipped: string[] = [];

    const targets: Array<{ decl: ts.VariableStatement; src: string; binds: Array<{ local: string; prop: string; pos: number }> }> = [];
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const decl of statement.declarationList.declarations) {
        if (!ts.isObjectBindingPattern(decl.name) || !decl.initializer) continue;
        const src = ModuleDestructureFold.plainSource(decl.initializer, source);
        if (!src) { skipped.push(`${path.basename(file)}: initialiser is not a plain reference`); continue; }
        const binds: Array<{ local: string; prop: string; pos: number }> = [];
        let ok = true;
        for (const element of decl.name.elements) {
          if (element.dotDotDotToken || element.initializer || !ts.isIdentifier(element.name)) { ok = false; break; }
          const prop = element.propertyName && ts.isIdentifier(element.propertyName)
            ? element.propertyName.text : element.name.text;
          binds.push({ local: element.name.text, prop, pos: element.name.getStart(source) });
        }
        if (!ok) { skipped.push(`${path.basename(file)}: rest element or default value — left alone`); continue; }
        targets.push({ decl: statement, src, binds });
      }
    }
    if (!targets.length) return { folded: 0, skipped };

    // A single-file program is enough: these bindings are module-local, so every reference is in this file.
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

    const edits: Array<{ start: number; end: number; text: string }> = [];
    for (const target of targets) {
      for (const bind of target.binds) {
        const locations = service.findRenameLocations(file, bind.pos, false, false, {}) ?? [];
        for (const loc of locations) {
          if (loc.fileName !== file) continue;
          // the binding site itself is removed with the declaration
          if (loc.textSpan.start >= target.decl.getStart(source) && loc.textSpan.start < target.decl.getEnd()) continue;
          edits.push({
            start: loc.textSpan.start,
            end: loc.textSpan.start + loc.textSpan.length,
            text: `${target.src}.${bind.prop}`,
          });
        }
      }
      // drop the declaration, including the newline it sits on
      let end = target.decl.getEnd();
      if (original[end] === '\n') end += 1;
      edits.push({ start: target.decl.getFullStart(), end, text: '' });
    }

    edits.sort((a, b) => b.start - a.start);
    let text = original;
    for (const edit of edits) text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
    if (apply && text !== original) writeFileSync(file, text, 'utf8');
    return { folded: targets.reduce((n, t) => n + t.binds.length, 0), skipped };
  }

  /** Fold every file under `dir`. */
  static run(dir: string, apply: boolean): { files: string[]; bindings: number; skipped: string[] } {
    const files: string[] = [];
    const skipped: string[] = [];
    let bindings = 0;
    for (const file of ModuleDestructureFold.walk(dir)) {
      const text = readFileSync(file, 'utf8');
      if (!/^(export\s+)?(const|let)\s*\{/m.test(text)) continue;
      const result = ModuleDestructureFold.runFile(file, apply);
      skipped.push(...result.skipped);
      if (result.folded) { files.push(file); bindings += result.folded; }
    }
    return { files, bindings, skipped };
  }
}
