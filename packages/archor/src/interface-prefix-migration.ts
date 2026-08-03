import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { WorkspaceTypecheck } from './workspace-typecheck';

/**
 * Renames every `export interface Foo` to `IFoo`, updating every reference.
 *
 * **Uses the language service's own rename, never text substitution.** A regex pass over this repo once
 * renamed matching words inside COMMENTS and JSX tags and injected cross-package imports, corrupting 475
 * files. `findRenameLocations` returns the exact spans of the SYMBOL — declaration, imports, type
 * positions — and nothing else, so a comment mentioning `Foo` is untouched.
 *
 * A file keeps its kebab name (`assistant-action.interface.ts` holds `IAssistantAction`), matching the
 * files that already follow the convention.
 */
export class InterfacePrefixMigration {
  private static readonly SKIP_DIRS = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git',
  ]);

  private static walk(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const name of entries) {
      if (InterfacePrefixMigration.SKIP_DIRS.has(name)) continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) InterfacePrefixMigration.walk(full, out);
      else if (/\.tsx?$/.test(full) && !full.endsWith('.d.ts')) out.push(full);
    }
    return out;
  }

  /** Every `export interface X` in `files` whose name is not already `I<Capital>`. */
  private static candidates(program: ts.Program, files: string[]): Array<{ file: string; pos: number; name: string }> {
    const found: Array<{ file: string; pos: number; name: string }> = [];
    for (const file of files) {
      const source = program.getSourceFile(file);
      if (!source) continue;
      for (const statement of source.statements) {
        if (!ts.isInterfaceDeclaration(statement)) continue;
        if (!statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
        const name = statement.name.text;
        if (/^I[A-Z]/.test(name)) continue;
        found.push({ file, pos: statement.name.getStart(source), name });
      }
    }
    return found;
  }

  /**
   * Rename every unprefixed exported interface under `dir`.
   * Pass `apply: false` to count without writing.
   */
  static run(dir: string, framework: string, apply = true): { renamed: string[]; skipped: string[] } {
    const files = InterfacePrefixMigration.walk(dir);
    const shared = WorkspaceTypecheck.compilerOptions(framework) as { paths: Record<string, string[]> };
    const theme = /(.*[\\/]themes[\\/][^\\/]+)/.exec(dir)?.[1];
    const { options } = ts.convertCompilerOptionsFromJson({
      ...shared,
      paths: { ...(theme ? { '@theme/*': [path.join(theme, 'src', '*')] } : {}), ...shared.paths },
    }, dir);

    // A LanguageService is required for findRenameLocations — a bare Program cannot rename.
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
    if (!program) return { renamed: [], skipped: ['could not create a program'] };

    const renamed: string[] = [];
    const skipped: string[] = [];

    for (const candidate of InterfacePrefixMigration.candidates(program, files)) {
      const locations = service.findRenameLocations(candidate.file, candidate.pos, false, false, {});
      if (!locations?.length) {
        skipped.push(`${candidate.name}: no rename locations`);
        continue;
      }
      // group edits per file, applied back-to-front so earlier spans keep their offsets
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
          const end = start + loc.textSpan.length;
          text = `${text.slice(0, start)}I${candidate.name}${text.slice(end)}`;
        }
        contents.set(file, text);
        versions.set(file, (versions.get(file) ?? 0) + 1);
      }
      renamed.push(`${candidate.name} -> I${candidate.name} (${locations.length} reference(s))`);
    }

    if (apply) {
      for (const [file, text] of contents) {
        if (text !== ts.sys.readFile(file)) writeFileSync(file, text, 'utf8');
      }
    }
    return { renamed, skipped };
  }
}
