import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Rewrites a module-level `type X = { … }` object-shape alias into `interface IX { … }`.
 *
 * An object-shape alias and an interface are the same type to the compiler, so this is free — but only an
 * `interface` is a DECLARATION, which is what the house rule is about. The alias also cannot carry a JSDoc
 * that tooling recognises as a declaration comment.
 *
 * **Uses the language service's rename**, never text substitution: a regex pass over this repo once
 * renamed matching words inside comments and JSX tags and corrupted 475 files.
 *
 * Deliberately narrow — it converts ONLY when every one of these holds, because anything else risks
 * changing meaning:
 *  - the RHS is a single object literal type (`{ … }`), not a union, intersection or mapped type;
 *  - the alias takes no type parameters (`type Foo<T> = …` has no interface form that behaves the same
 *    for every consumer once it is also used as a value position);
 *  - the target name `IX` is not already taken in that file.
 *
 * A union (`'a' | 'b'`) is a reactor `Enum`'s job, and an intersection is left alone: `interface X extends A`
 * is only equivalent when the left side is a named type, which is a separate, less mechanical judgement.
 */
export class TypeAliasToInterface {
  private static readonly SKIP_DIRS = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git',
  ]);

  private static walk(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const name of entries) {
      if (TypeAliasToInterface.SKIP_DIRS.has(name)) continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) TypeAliasToInterface.walk(full, out);
      else if (/\.tsx?$/.test(full) && !full.endsWith('.d.ts')) out.push(full);
    }
    return out;
  }

  /** Every eligible alias in `files`, as a rename target plus the span of the `type`/`=`/`;` scaffolding. */
  private static candidates(program: ts.Program, files: string[]): Array<{
    file: string; pos: number; name: string;
  }> {
    const found: Array<{ file: string; pos: number; name: string }> = [];
    for (const file of files) {
      const source = program.getSourceFile(file);
      if (!source) continue;
      const taken = new Set<string>();
      for (const statement of source.statements) {
        if (ts.isInterfaceDeclaration(statement)) taken.add(statement.name.text);
        if (ts.isClassDeclaration(statement) && statement.name) taken.add(statement.name.text);
      }
      for (const statement of source.statements) {
        if (!ts.isTypeAliasDeclaration(statement)) continue;
        if (statement.typeParameters?.length) continue;
        if (!ts.isTypeLiteralNode(statement.type)) continue;
        const name = statement.name.text;
        if (/^I[A-Z]/.test(name)) continue;
        if (taken.has(`I${name}`)) continue;
        found.push({ file, pos: statement.name.getStart(source), name });
      }
    }
    return found;
  }

  /**
   * Convert every eligible alias under `dir`. Pass `apply: false` to count without writing.
   *
   * Two passes on purpose: the RENAME goes through the language service across all files, then the
   * `type X = {` → `interface X {` keyword swap is a per-declaration edit applied back-to-front so
   * earlier offsets stay valid.
   */
  static run(dir: string, framework: string, apply = true): { converted: string[]; skipped: string[] } {
    const files = TypeAliasToInterface.walk(dir);
    const { options } = ts.convertCompilerOptionsFromJson({
      target: 'esnext', module: 'commonjs', jsx: 'react-jsx', allowJs: false,
      esModuleInterop: true, skipLibCheck: true, noEmit: true,
    }, dir);

    const contents = new Map<string, string>();
    for (const file of files) contents.set(file, readFileSync(file, 'utf8'));
    const versions = new Map<string, number>(files.map((f) => [f, 0]));

    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => files,
      getScriptVersion: (f) => String(versions.get(f) ?? 0),
      getScriptSnapshot: (f) => {
        const text = contents.get(f) ?? ts.sys.readFile(f);
        return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
      },
      getCurrentDirectory: () => dir,
      getCompilationSettings: () => options,
      getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
      fileExists: ts.sys.fileExists,
      readFile: (f) => contents.get(f) ?? ts.sys.readFile(f),
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    };
    const service = ts.createLanguageService(host, ts.createDocumentRegistry());
    const program = service.getProgram();
    if (!program) return { converted: [], skipped: ['could not create a program'] };

    const converted: string[] = [];
    const skipped: string[] = [];

    for (const candidate of TypeAliasToInterface.candidates(program, files)) {
      const locations = service.findRenameLocations(candidate.file, candidate.pos, false, false, {});
      if (!locations?.length) {
        skipped.push(`${candidate.name}: no rename locations`);
        continue;
      }
      const byFile = new Map<string, ts.RenameLocation[]>();
      for (const loc of locations) {
        const list = byFile.get(loc.fileName) ?? [];
        list.push(loc);
        byFile.set(loc.fileName, list);
      }
      for (const [file, locs] of byFile) {
        let text = contents.get(file) ?? ts.sys.readFile(file) ?? '';
        for (const loc of [...locs].sort((a, b) => b.textSpan.start - a.textSpan.start)) {
          const start = loc.textSpan.start;
          text = `${text.slice(0, start)}I${candidate.name}${text.slice(start + loc.textSpan.length)}`;
        }
        contents.set(file, text);
        versions.set(file, (versions.get(file) ?? 0) + 1);
      }
      converted.push(`${candidate.name} -> I${candidate.name} (${locations.length} reference(s))`);
    }

    // keyword swap: `type IX = { … };` -> `interface IX { … }`
    for (const file of files) {
      const text = contents.get(file);
      if (!text) continue;
      const reparsed = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const edits: Array<{ start: number; end: number; replacement: string }> = [];
      for (const statement of reparsed.statements) {
        if (!ts.isTypeAliasDeclaration(statement)) continue;
        if (statement.typeParameters?.length || !ts.isTypeLiteralNode(statement.type)) continue;
        if (!/^I[A-Z]/.test(statement.name.text)) continue;
        const exported = ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        const body = statement.type.getText(reparsed);
        edits.push({
          start: statement.getStart(reparsed),
          end: statement.end,
          replacement: `${exported ? 'export ' : ''}interface ${statement.name.text} ${body}`,
        });
      }
      if (!edits.length) continue;
      let out = text;
      for (const edit of edits.sort((a, b) => b.start - a.start)) {
        out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end);
      }
      contents.set(file, out);
    }

    if (apply) {
      for (const [file, text] of contents) {
        if (text !== ts.sys.readFile(file)) writeFileSync(file, text, 'utf8');
      }
    }
    return { converted, skipped };
  }
}
