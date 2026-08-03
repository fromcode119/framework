import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Moves a module-level `const` / `let` onto the class that uses it, as a `private static` member.
 *
 * A loose module constant is invisible to the type system's access rules, cannot be reset in a test, and
 * gives the value no name to be reasoned about — `const ICON_SIZE = 42;` belongs to the component that
 * renders at that size.
 *
 * **Why the AST.** A previous regex version of this fold damaged 2 of 17 files: a `;` inside a comment
 * broke its span detection, and a dropped type annotation silently turned
 * `ReturnType<typeof setTimeout> | null` into `null`. Declaration spans, type annotations and initialisers
 * come from the compiler here, so neither failure is expressible.
 *
 * Conservative — a file is skipped unless every one of these holds:
 *  - exactly ONE class in the file (otherwise which class owns the constant is a guess);
 *  - the declaration is not exported (an exported const is a different violation, not this one);
 *  - the name is not re-declared in any nested scope (renaming through a shadow would change meaning);
 *  - every reference sits INSIDE the class (a reference from another top-level statement cannot move);
 *  - the initialiser does not reference the class (that would be a use-before-definition at class-init).
 */
export class ModuleConstantFold {
  private static readonly SKIP_DIRS = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git', 'tests',
  ]);

  private static walk(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const name of entries) {
      if (ModuleConstantFold.SKIP_DIRS.has(name)) continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) ModuleConstantFold.walk(full, out);
      else if (/\.tsx?$/.test(full) && !full.endsWith('.d.ts') && !/\.(test|spec)\./.test(full)) out.push(full);
    }
    return out;
  }

  /** Every identifier occurrence of `name` that is a genuine VALUE reference, not a declaration or a member. */
  private static references(source: ts.SourceFile, name: string): ts.Identifier[] {
    const found: ts.Identifier[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && node.text === name) {
        const parent = node.parent;
        const isMemberName = ts.isPropertyAccessExpression(parent) && parent.name === node;
        const isPropertyKey = ts.isPropertyAssignment(parent) && parent.name === node;
        const isDeclarationName = (ts.isVariableDeclaration(parent) || ts.isPropertyDeclaration(parent)
          || ts.isParameter(parent) || ts.isBindingElement(parent)) && parent.name === node;
        if (!isMemberName && !isPropertyKey && !isDeclarationName) found.push(node);
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(source, visit);
    return found;
  }

  /** True when any nested scope declares the same name — renaming through a shadow changes meaning. */
  private static isShadowed(source: ts.SourceFile, name: string, declaration: ts.Node): boolean {
    let shadowed = false;
    const visit = (node: ts.Node): void => {
      if (shadowed || node === declaration) return;
      if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node))
          && ts.isIdentifier(node.name) && node.name.text === name) {
        shadowed = true;
        return;
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(source, visit);
    return shadowed;
  }

  /** The declaration's own leading JSDoc, re-indented one level, or '' when it has none. */
  private static leadingDoc(statement: ts.Statement, text: string): string {
    const full = statement.getFullText();
    const doc = /^\s*(\/\*\*[\s\S]*?\*\/)/.exec(full);
    if (!doc) return '';
    return `${doc[1].split('\n').map((line, i) => (i === 0 ? `  ${line.trim()}` : `  ${line.trim().replace(/^\*/, ' *')}`)).join('\n')}\n`;
  }

  /**
   * The class member a module declaration becomes.
   *
   * A function-valued constant becomes a real `private static` METHOD, not a static arrow PROPERTY —
   * an arrow-function member is itself a house-rule violation, so folding one in would trade a
   * module-level `const` for a different offence.
   */
  private static memberFor(
    statement: ts.VariableStatement,
    declaration: ts.VariableDeclaration,
    name: string,
  ): string {
    const initializer = declaration.initializer!;
    if ((ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
        && !initializer.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
      const parameters = initializer.parameters.map((p) => p.getText()).join(', ');
      const returns = initializer.type ? `: ${initializer.type.getText()}` : '';
      const body = ts.isBlock(initializer.body)
        ? initializer.body.getText().replace(/^\{\n?/, '').replace(/\n?\}$/, '')
        : `    return ${initializer.body.getText()};`;
      return `  private static ${name}(${parameters})${returns} {\n${body}\n  }`;
    }
    const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
    const type = declaration.type ? `: ${declaration.type.getText()}` : '';
    return `  private static ${isConst ? 'readonly ' : ''}${name}${type} = ${initializer.getText()};`;
  }

  /** Fold one file; returns the rewritten text, or null when nothing was safe to move. */
  static transform(text: string, file: string): string | null {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

    const classes = source.statements.filter(ts.isClassDeclaration);
    if (classes.length !== 1) return null;
    const cls = classes[0];
    if (!cls.name) return null;
    const className = cls.name.text;

    // Names the class already declares. A module const that the class re-exposes
    // (`static canonicalCmsBlocks = canonicalCmsBlocks;`) would otherwise be folded in ON TOP of that
    // member — a duplicate identifier whose initialiser then refers to itself.
    const declared = new Set(cls.members
      .filter((m) => m.name && ts.isIdentifier(m.name))
      .map((m) => (m.name as ts.Identifier).text));

    type Move = { statement: ts.Statement; name: string; member: string; refs: ts.Identifier[] };
    const moves: Move[] = [];

    /** Shared eligibility: not exported, not already a member, not shadowed, referenced ONLY inside the class. */
    const eligible = (name: string, declarationName: ts.Node, exported: boolean, selfReferential: boolean) => {
      if (exported) return null;
      if (declared.has(name)) return null;
      if (ModuleConstantFold.isShadowed(source, name, declarationName)) return null;
      if (selfReferential) return null;
      const refs = ModuleConstantFold.references(source, name).filter((id) => id !== declarationName);
      if (!refs.length) return null;
      const allInsideClass = refs.every((identifier) => {
        let node: ts.Node = identifier;
        while (node.parent) {
          if (node === cls) return true;
          node = node.parent;
        }
        return false;
      });
      return allInsideClass ? refs : null;
    };

    for (const statement of source.statements) {
      const exported = ts.canHaveModifiers(statement)
        && (ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false);

      // A module-level FUNCTION becomes a `private static` METHOD. Same eligibility rules as a constant:
      // it is the single class's helper or it does not move.
      if (ts.isFunctionDeclaration(statement)) {
        if (!statement.name || !statement.body) continue;
        const name = statement.name.text;
        const refs = eligible(name, statement.name, exported, statement.getText().includes(`${className}.`));
        if (!refs) continue;
        const parameters = statement.parameters.map((param) => param.getText()).join(', ');
        const returns = statement.type ? `: ${statement.type.getText()}` : '';
        const isAsync = ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ? 'async ' : '';
        const generics = statement.typeParameters?.length
          ? `<${statement.typeParameters.map((t) => t.getText()).join(', ')}>`
          : '';
        const body = statement.body.getText().replace(/^\{\n?/, '').replace(/\n?\}$/, '');
        const doc = ModuleConstantFold.leadingDoc(statement, text);
        moves.push({
          statement,
          name,
          member: `${doc}  private static ${isAsync}${name}${generics}(${parameters})${returns} {\n${body}\n  }`,
          refs,
        });
        continue;
      }

      if (!ts.isVariableStatement(statement)) continue;
      if (statement.declarationList.declarations.length !== 1) continue;

      const declaration = statement.declarationList.declarations[0];
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      const name = declaration.name.text;
      // A `const X = new Something(ClassName)` cannot become a static of that same class.
      const refs = eligible(name, declaration.name, exported, declaration.initializer.getText().includes(className));
      if (!refs) continue;

      const member = ModuleConstantFold.memberFor(statement, declaration, name);
      moves.push({ statement, name, member, refs });
    }

    if (!moves.length) return null;

    const edits: Array<{ start: number; end: number; replacement: string }> = [];
    for (const move of moves) {
      const start = text.lastIndexOf('\n', move.statement.getStart()) + 1;
      const end = text[move.statement.end] === '\n' ? move.statement.end + 1 : move.statement.end;
      edits.push({ start, end, replacement: '' });
      for (const reference of move.refs) {
        edits.push({ start: reference.getStart(), end: reference.end, replacement: `${className}.${move.name}` });
      }
    }
    edits.push({
      start: cls.members.pos,
      end: cls.members.pos,
      replacement: `\n${moves.map((m) => m.member).join('\n')}\n`,
    });

    let out = text;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end);
    }
    // never write something that does not parse — the one check a bad edit cannot slip past
    const reparsed = ts.createSourceFile(file, out, ts.ScriptTarget.ESNext, true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    if ((reparsed as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics?.length) return null;
    return out;
  }

  /** Fold every eligible file under `target`; pass `apply: false` to count without writing. */
  static run(target: string, apply = true): string[] {
    const changed: string[] = [];
    for (const file of ModuleConstantFold.walk(target)) {
      const text = readFileSync(file, 'utf8');
      const out = ModuleConstantFold.transform(text, file);
      if (!out || out === text) continue;
      if (apply) writeFileSync(file, out, 'utf8');
      changed.push(file);
    }
    return changed;
  }
}
