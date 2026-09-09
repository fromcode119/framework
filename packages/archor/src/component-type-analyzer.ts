import path from 'node:path';
import ts from 'typescript';

/**
 * Reads TYPES for the component migration: what a member's type mentions, where those names are
 * declared, and whether an interface can be expressed as fields at all.
 *
 * Split out of ComponentDecoratorMigration (765 lines) 2026-09-09. Pure inspection — it never edits
 * source text, which is what keeps the "can this be converted?" question answerable on its own.
 */
export class ComponentTypeAnalyzer {
  /**
   * Every type NAME a member's type mentions, paired with the specifier the declaring file imports it
   * from (or its own file, when declared there).
   *
   * Moving a member out of `IPlansPageState` and onto the class moves its TYPE TEXT into a different
   * file — and that text can name something only the interface's file imports. `@state options:
   * PlanOptions = …` compiled to `Cannot find name 'PlanOptions'` for exactly this reason. The type has
   * to bring its imports with it.
   */
  static typeDependencies(
    type: ts.TypeNode,
    checker: ts.TypeChecker,
  ): Map<string, string> {
    const deps = new Map<string, string>();
    const visit = (node: ts.Node): void => {
      if (ts.isTypeReferenceNode(node)) {
        const root = ts.isQualifiedName(node.typeName) ? node.typeName.left : node.typeName;
        if (ts.isIdentifier(root)) {
          const symbol = checker.getSymbolAtLocation(root);
          const decl = symbol?.declarations?.[0];
          if (decl) {
            const from = decl.getSourceFile();
            // A lib/global type (`Record`, `Promise`, `Date`) needs no import.
            if (!from.isDeclarationFile) {
              const spec = ts.isImportSpecifier(decl) || ts.isImportClause(decl)
                ? ComponentTypeAnalyzer.specifierOf(decl)
                : from.fileName;
              // `import type { IProvider as Provider }` — the type text says `Provider`, the module
              // exports `Provider`. Importing the local name alone yields "Cannot find name 'Provider'".
              const exported = ts.isImportSpecifier(decl) && decl.propertyName
                ? decl.propertyName.text : root.text;
              if (spec) deps.set(root.text, `${exported}\u0000${spec}`);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(type);
    return deps;
  }


  /**
   * True when a type mentions a name nothing declares.
   *
   * `interface IState { providers: Provider[] }` with no `Provider` in scope is already broken where it
   * sits — copying that text onto the class merely spreads the breakage to a second file. The migration
   * refuses rather than propagating it.
   */
  static hasUnresolvedName(type: ts.TypeNode, checker: ts.TypeChecker): boolean {
    let unresolved = false;
    const visit = (node: ts.Node): void => {
      if (unresolved) return;
      if (ts.isTypeReferenceNode(node)) {
        const root = ts.isQualifiedName(node.typeName) ? node.typeName.left : node.typeName;
        if (ts.isIdentifier(root) && !checker.getSymbolAtLocation(root)) { unresolved = true; return; }
      }
      ts.forEachChild(node, visit);
    };
    visit(type);
    return unresolved;
  }


  /** The module specifier text of the import declaration an import specifier belongs to. */
  static specifierOf(decl: ts.Declaration): string | null {
    let node: ts.Node = decl;
    while (node && !ts.isImportDeclaration(node)) node = node.parent;
    if (!node || !ts.isImportDeclaration(node)) return null;
    const spec = node.moduleSpecifier;
    if (!ts.isStringLiteral(spec)) return null;
    // A relative specifier is relative to the DECLARING file — resolve it so the caller can re-base it.
    if (spec.text.startsWith('.')) {
      return path.resolve(path.dirname(decl.getSourceFile().fileName), spec.text);
    }
    return spec.text;
  }


  /** Members of an interface declared anywhere in the program, or of an inline type literal. */
  static membersOf(
    node: ts.TypeNode,
    checker: ts.TypeChecker,
  ): Array<{ name: string; optional: boolean; type: string; node: ts.TypeNode }> | null {
    let decl: ts.InterfaceDeclaration | ts.TypeLiteralNode | null = null;
    if (ts.isTypeLiteralNode(node)) decl = node;
    else if (ts.isTypeReferenceNode(node)) {
      // An IMPORTED interface resolves to the import alias, whose declaration is the ImportSpecifier —
      // not the interface. Without the extra hop every cross-file interface reads as "unresolved" and
      // the whole class is skipped, which is what made the first run convert 6 files instead of 250.
      let symbol = checker.getSymbolAtLocation(node.typeName);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      const target = symbol?.declarations?.find(ts.isInterfaceDeclaration);
      if (target) decl = target;
    }
    if (!decl) return null;
    // `interface IProductDefaultsProps extends IRuntimeProps` lists only its OWN members here, so the
    // inherited ones were never declared while their reads were still rewritten to `this.x`.
    if (ts.isInterfaceDeclaration(decl) && decl.heritageClauses?.length) return null;

    const out: Array<{ name: string; optional: boolean; type: string; node: ts.TypeNode }> = [];
    for (const member of decl.members) {
      // A method signature is a contract, not a field — those do not become `@prop`.
      if (!ts.isPropertySignature(member) || !member.type || !ts.isIdentifier(member.name)) return null;
      out.push({
        name: member.name.text,
        optional: Boolean(member.questionToken),
        type: member.type.getText(),
        node: member.type,
      });
    }
    return out.length ? out : null;
  }


  /** A sensible initial value when the class had no `state = { … }` entry for a field. */
  static defaultFor(type: string): string {
    const t = type.trim();
    if (t.endsWith('[]') || t.startsWith('Array<')) return '[]';
    if (t.includes('null')) return 'null';
    if (t.startsWith('Record<') || t === 'object') return '{}';
    if (t === 'boolean') return 'false';
    if (t === 'number') return '0';
    if (t === 'string') return "''";
    return 'undefined as never';
  }


  /**
   * `[] as Array<X>` inside a `state = { … }` bag only existed to widen an inferred type. On a declared
   * field the annotation already says it, so the cast is noise — dropped when it names the same type.
   */
  static withoutRedundantCast(init: string, type: string): string {
    const cast = /^(.*?)\s+as\s+(.+)$/s.exec(init.trim());
    return cast && cast[2].trim() === type.trim() ? cast[1].trim() : init;
  }
}
