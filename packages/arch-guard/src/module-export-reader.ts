import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { IModuleExport } from './interfaces/module-export.interface';

/**
 * Every top-level export a `.ts`/`.tsx` file declares, read from the TypeScript AST rather than a
 * regex — a class, interface or function can be named almost anything, preceded by a decorator, or
 * appear only as TEXT inside a comment or a template-literal codegen string, and a pattern loose
 * enough to catch the real declarations is loose enough to also fire on a string that merely mentions
 * the word. `ThemeScaffoldFiles`/`ThemeEntryGenerator`/`PluginScaffoldCommandService` each write a
 * `export class …` INSIDE a template literal that becomes another file's source; a lexical scan reads
 * that text and reports a second class in the wrong file, which is exactly the false positive
 * `ThemeScaffoldFiles`'s own docblock records having nearly been split over. The compiler already
 * resolves exactly which top-level statements are real declarations; asking it is both simpler and
 * correct where a regex or a naive text match would need constant patching.
 */
export class ModuleExportReader {
  /**
   * `.ts` and `.tsx` need DIFFERENT parse modes. Parsing every file as TSX misreads legacy type
   * assertions (`<string>value`, `<T>(x: T) => x`) — valid TS, invalid outside a `.tsx` file — as a
   * JSX open tag, which truncates the parse silently: whatever comes after is invisible to every
   * caller, not merely mis-classified. `.tsx` files still need TSX mode for real JSX.
   */
  private static scriptKindFor(file: string): ts.ScriptKind {
    return file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  }

  /**
   * Parses one file. Returns `null` (rather than a silently-partial result) when the parse itself
   * failed — `ts.createSourceFile` does not throw on a syntax error, it produces a best-effort tree
   * and records the problem on the source file's own (unexported, but populated) `parseDiagnostics`.
   * A caller that ignored this would report "clean" for a file the compiler could not actually read.
   */
  static parse(file: string): ts.SourceFile | null {
    let source: string;
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      return null;
    }
    const sourceFile = ts.createSourceFile(
      file, source, ts.ScriptTarget.Latest, true, ModuleExportReader.scriptKindFor(file),
    );
    const diagnostics = (sourceFile as unknown as { parseDiagnostics?: readonly unknown[] }).parseDiagnostics;
    if (diagnostics && diagnostics.length > 0) return null;
    return sourceFile;
  }

  private static hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    return !!modifiers?.some((m) => m.kind === kind);
  }

  private static isExported(node: ts.Node): boolean {
    return ModuleExportReader.hasModifier(node, ts.SyntaxKind.ExportKeyword);
  }

  private static isDefault(node: ts.Node): boolean {
    return ModuleExportReader.hasModifier(node, ts.SyntaxKind.DefaultKeyword);
  }

  /** The declaration kind of an already-known top-level statement, keyed by the name it binds. */
  private static localKinds(statements: readonly ts.Statement[]): Map<string, IModuleExport['kind']> {
    const kinds = new Map<string, IModuleExport['kind']>();
    for (const statement of statements) {
      if (ts.isClassDeclaration(statement) && statement.name) kinds.set(statement.name.text, 'class');
      else if (ts.isInterfaceDeclaration(statement)) kinds.set(statement.name.text, 'interface');
      else if (ts.isFunctionDeclaration(statement) && statement.name) kinds.set(statement.name.text, 'function');
      else if (ts.isEnumDeclaration(statement)) kinds.set(statement.name.text, 'enum');
      else if (ts.isTypeAliasDeclaration(statement)) kinds.set(statement.name.text, 'type');
      else if (ts.isVariableStatement(statement)) {
        for (const decl of statement.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            kinds.set(decl.name.text, decl.initializer && ts.isClassExpression(decl.initializer) ? 'class' : 'variable');
          }
        }
      }
    }
    return kinds;
  }

  /** Every declaration this file EXPORTS at the top level — the only level this rule governs. */
  static exportsOf(sourceFile: ts.SourceFile): IModuleExport[] {
    const exported: IModuleExport[] = [];
    const statements = sourceFile.statements;
    const locals = ModuleExportReader.localKinds(statements);

    for (const statement of statements) {
      if (ts.isClassDeclaration(statement) && ModuleExportReader.isExported(statement)) {
        const name = statement.name?.text ?? (ModuleExportReader.isDefault(statement) ? '(default)' : '(anonymous)');
        exported.push({ kind: 'class', name });
      } else if (ts.isInterfaceDeclaration(statement) && ModuleExportReader.isExported(statement)) {
        exported.push({ kind: 'interface', name: statement.name.text });
      } else if (ts.isFunctionDeclaration(statement) && ModuleExportReader.isExported(statement)) {
        const name = statement.name?.text ?? (ModuleExportReader.isDefault(statement) ? '(default)' : '(anonymous)');
        exported.push({ kind: 'function', name });
      } else if (ts.isEnumDeclaration(statement) && ModuleExportReader.isExported(statement)) {
        exported.push({ kind: 'enum', name: statement.name.text });
      } else if (ts.isTypeAliasDeclaration(statement) && ModuleExportReader.isExported(statement)) {
        exported.push({ kind: 'type', name: statement.name.text });
      } else if (ts.isVariableStatement(statement) && ModuleExportReader.isExported(statement)) {
        for (const decl of statement.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name)) continue;
          const isClassExpr = decl.initializer && ts.isClassExpression(decl.initializer);
          exported.push({ kind: isClassExpr ? 'class' : 'variable', name: decl.name.text });
        }
      } else if (ts.isExportAssignment(statement)) {
        // `export default <expr>` — an anonymous default-exported class still counts as the file's
        // one class export; anything else is generic for this rule's purposes.
        const isClassExpr = ts.isClassExpression(statement.expression);
        exported.push({ kind: isClassExpr ? 'class' : 'other', name: '(default)' });
      } else if (ts.isExportDeclaration(statement)) {
        if (statement.moduleSpecifier) {
          // Re-export FROM another module: `export { X } from '…'` / `export * from '…'`. Barrels are
          // excluded from this guard entirely before reaching here; a non-barrel file doing this is
          // treated as exporting "something of unknown kind" so it still counts toward the total.
          if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
            for (const el of statement.exportClause.elements) exported.push({ kind: 'other', name: el.name.text });
          } else {
            exported.push({ kind: 'other', name: '*' });
          }
        } else if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
          // `export { X }` with no `from`: X was declared locally, possibly without its own `export`
          // keyword. Resolve its real kind from the first pass so it is not miscounted as generic.
          for (const el of statement.exportClause.elements) {
            const localName = el.propertyName?.text ?? el.name.text;
            exported.push({ kind: locals.get(localName) ?? 'other', name: el.name.text });
          }
        }
      }
    }
    return exported;
  }
}
