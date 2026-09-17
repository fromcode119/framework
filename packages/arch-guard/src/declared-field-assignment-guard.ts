import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { IClassFacts } from './interfaces/class-facts.interface';

/**
 * A `declare`d field must be ASSIGNED by the class or one of its subclasses, or it is permanently
 * `undefined`.
 *
 * `protected declare tokens: PluginInvocationTokens;` emits nothing at all. That is the whole point
 * of a shared `*State` base — the concrete class owns the real fields, so nothing is constructed
 * twice — but it means a field initialiser MOVED onto that base silently stops running, and the
 * compiler is perfectly happy either way: `strictPropertyInitialization` does not look at `declare`.
 *
 * It has cost this codebase three outages, every one found by a person rather than by a build:
 *
 *   - `PluginManager.hooks` became `declare`, so `new HookManager()` never ran and the first
 *     `this.hooks.on('*')` threw on every boot.
 *   - `PluginHost.tokens` became `declare`, so `invoke()` called `this.tokens.mint(...)` on
 *     `undefined` and TWELVE plugins failed `onInit` on a local boot, each reported as its own
 *     mysterious "failed to register".
 *   - `TenantAdminService.gateway` became `declare`, so creating, importing, renaming or deleting a
 *     site threw instead of reloading the platform gateway's host map.
 *
 * WHAT IS CHECKED. A field is reported only when all of these hold, PER CLASS — not per file and not
 * per package, because `target` and `fetch` are declared in one class and used in another:
 *
 *   - it is `declare`d, so it emits nothing;
 *   - the class or a subclass DEREFERENCES it (`this.x.foo`, `this.x?.foo`, `this.x(...)`), so
 *     `undefined` is a crash rather than a falsy value somebody meant;
 *   - neither the class nor any subclass assigns it, by `this.x =` or as a constructor parameter.
 *
 * The dereference requirement is what makes this usable: `declare` is also the honest way to write a
 * DTO whose shape a factory fills in, and about 200 of those fields exist here. They are READ, never
 * called. All three real bugs were calls.
 */
export class DeclaredFieldAssignmentGuard {
  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git', 'tests', '__tests__',
  ]);

  /** React assigns these itself — `props` and `state` on the instance, `context` from `contextType`. */
  private static readonly REACT_OWNED = new Set(['props', 'state', 'context']);

  private static files(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      if (statSync(full, { throwIfNoEntry: false })?.isDirectory()) {
        if (!DeclaredFieldAssignmentGuard.SKIP_DIR.has(entry)) DeclaredFieldAssignmentGuard.files(full, out);
      } else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  /** The base class's NAME, ignoring type arguments — inheritance is matched by name within a tree. */
  private static baseNameOf(node: ts.ClassDeclaration): string | null {
    const heritage = node.heritageClauses?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword);
    const expression = heritage?.types[0]?.expression;
    return expression && ts.isIdentifier(expression) ? expression.text : null;
  }

  /**
   * Everything that gives a field a value in one class body: `this.x = …`, a constructor parameter
   * property, and a REDECLARATION carrying an initialiser — a subclass writing
   * `protected themes = new Map()` over the base's `declare themes` is the normal way to do this.
   */
  private static collectAssignments(node: ts.ClassDeclaration, into: Set<string>): void {
    for (const member of node.members) {
      if (ts.isConstructorDeclaration(member)) {
        for (const parameter of member.parameters) {
          if (parameter.modifiers?.length && ts.isIdentifier(parameter.name)) into.add(parameter.name.text);
        }
      }
      if (ts.isPropertyDeclaration(member) && member.initializer && ts.isIdentifier(member.name)) {
        into.add(member.name.text);
      }
    }
    const visit = (child: ts.Node): void => {
      if (ts.isBinaryExpression(child)
          && child.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && ts.isPropertyAccessExpression(child.left)
          && child.left.expression.kind === ts.SyntaxKind.ThisKeyword) {
        into.add(child.left.name.text);
      }
      ts.forEachChild(child, visit);
    };
    ts.forEachChild(node, visit);
  }

  /** Every `this.x.…`, `this.x?.…` and `this.x(…)` in one class body. */
  private static collectDereferences(node: ts.ClassDeclaration, into: Set<string>): void {
    const named = (expression: ts.Expression): void => {
      if (ts.isPropertyAccessExpression(expression) && expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
        into.add(expression.name.text);
      }
    };
    const visit = (child: ts.Node): void => {
      if (ts.isPropertyAccessExpression(child)) named(child.expression);
      else if (ts.isElementAccessExpression(child)) named(child.expression);
      else if (ts.isCallExpression(child)) named(child.expression);
      ts.forEachChild(child, visit);
    };
    ts.forEachChild(node, visit);
  }

  /**
   * Class name -> what each class of that name declares, assigns and calls into.
   *
   * A LIST per name, because the tree has more than one `ThemeManager`. Keyed by name alone they
   * overwrote each other and the survivor's family lost every real subclass — which reported six
   * perfectly well-assigned fields.
   */
  private static facts(files: readonly string[]): Map<string, IClassFacts[]> {
    const byName = new Map<string, IClassFacts[]>();
    for (const file of files) {
      let source: ts.SourceFile;
      try {
        source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      } catch {
        continue;
      }
      for (const statement of source.statements) {
        if (!ts.isClassDeclaration(statement) || !statement.name) continue;
        const entry: IClassFacts = {
          file,
          base: DeclaredFieldAssignmentGuard.baseNameOf(statement),
          declared: [],
          assigns: new Set(),
          dereferences: new Set(),
        };
        for (const member of statement.members) {
          if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) continue;
          const modifiers = member.modifiers ?? [];
          if (!modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword)) continue;
          // A DECORATOR on a `declare`d field is how reactor says "the framework fills this in":
          // `@prop`, `@state` and `@ref` assign it from React's props, state and refs. Declaring
          // without a decorator is the case this guard is about — nobody is filling it in.
          if (modifiers.some((modifier) => ts.isDecorator(modifier))) continue;
          entry.declared.push(member.name.text);
        }
        DeclaredFieldAssignmentGuard.collectAssignments(statement, entry.assigns);
        DeclaredFieldAssignmentGuard.collectDereferences(statement, entry.dereferences);
        const existing = byName.get(statement.name.text);
        if (existing) existing.push(entry);
        else byName.set(statement.name.text, [entry]);
      }
    }
    return byName;
  }

  /**
   * Every class that is this one, or descends from it.
   *
   * Inheritance is matched by NAME, so where a name is ambiguous the walk follows every candidate.
   * That errs toward finding an assignment, which is the right direction: this guard must report the
   * field nobody assigns, never a field it merely could not follow.
   */
  private static family(name: string, byName: ReadonlyMap<string, IClassFacts[]>): IClassFacts[] {
    const family: IClassFacts[] = [];
    for (const [candidate, entries] of byName) {
      const seen = new Set<string>();
      let frontier: string[] = [candidate];
      let descends = false;
      while (frontier.length && !descends) {
        const next: string[] = [];
        for (const current of frontier) {
          if (current === name) { descends = true; break; }
          if (seen.has(current)) continue;
          seen.add(current);
          for (const entry of byName.get(current) ?? []) {
            if (entry.base) next.push(entry.base);
          }
        }
        frontier = next;
      }
      if (descends) family.push(...entries);
    }
    return family;
  }

  /** Every `declare`d field a class and its subclasses call into but never assign. */
  static scan(roots: readonly { area: string; dir: string }[]): Array<{ file: string; className: string; field: string }> {
    const offenders: Array<{ file: string; className: string; field: string }> = [];
    for (const { dir } of roots) {
      const byName = DeclaredFieldAssignmentGuard.facts(DeclaredFieldAssignmentGuard.files(dir));
      for (const [className, entries] of byName) {
        const family = DeclaredFieldAssignmentGuard.family(className, byName);
        const assigned = new Set(family.flatMap((entry) => [...entry.assigns]));
        const dereferenced = new Set(family.flatMap((entry) => [...entry.dereferences]));
        for (const facts of entries) {
          for (const field of facts.declared) {
            if (DeclaredFieldAssignmentGuard.REACT_OWNED.has(field)) continue;
            if (!dereferenced.has(field) || assigned.has(field)) continue;
            offenders.push({ file: facts.file, className, field });
          }
        }
      }
    }
    return offenders;
  }
}
