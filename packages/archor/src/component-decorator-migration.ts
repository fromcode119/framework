import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { WorkspaceTypecheck } from './workspace-typecheck';

/**
 * Rewrites a component's `<Props, State>` generics into `@prop` / `@state` fields.
 *
 *   export class Panel extends PluginComponent<IPanelProps, IPanelState> {
 *     state: IPanelState = { loading: true };
 *     render() { const { loading } = this.state; return <p>{this.props.title}</p>; }
 *   }
 *
 * becomes
 *
 *   export class Panel extends PluginComponent {
 *     @prop declare title: string;
 *     @state loading: boolean = true;
 *     render() { const { loading } = this; return <p>{this.title}</p>; }
 *   }
 *
 * **Why the TypeScript API and not a regex.** A regex version of this was attempted and failed three
 * separate times on the same construct — `=>` inside a type. The `>` of an arrow was counted as a closing
 * angle bracket, which truncated a generic mid-expression (`extends Reactor void;`), merged interface
 * members so only the first prop was emitted, and split argument lists wrongly. Types also nest through
 * unions, mapped types, generics and inline literals. The compiler already parses all of this exactly;
 * anything less is guessing.
 *
 * Conservative by design: a class is SKIPPED rather than half-converted whenever the migration cannot
 * prove the rewrite is complete — an unresolved interface, a member it cannot express as a field, or
 * props spread wholesale (`{...this.props}`), which has no field-by-field equivalent.
 */
export class ComponentDecoratorMigration {
  /**
   * Component base classes this migration recognises.
   *
   * The built-ins are REACTOR's own — typor may know its sibling toolchain package, the way nextor does.
   * It must NOT know a consuming project's base classes: `PluginComponent`, `AdminComponent` and
   * `ThemeComponent` were hardcoded here and welded a standalone package to one framework. A project
   * adds its own through `TYPOR_COMPONENT_BASES` (comma-separated), which its build script sets.
   */
  static readonly REACTOR_BASES: readonly string[] = ['Reactor', 'PureReactor', 'Provider'];

  static bases(): ReadonlySet<string> {
    const extra = String(process.env.TYPOR_COMPONENT_BASES ?? '')
      .split(',').map((name) => name.trim()).filter(Boolean);
    return new Set([...ComponentDecoratorMigration.REACTOR_BASES, ...extra]);
  }

  private static readonly SKIP_DIRS = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git',
  ]);

  /**
   * Every type NAME a member's type mentions, paired with the specifier the declaring file imports it
   * from (or its own file, when declared there).
   *
   * Moving a member out of `IPlansPageState` and onto the class moves its TYPE TEXT into a different
   * file — and that text can name something only the interface's file imports. `@state options:
   * PlanOptions = …` compiled to `Cannot find name 'PlanOptions'` for exactly this reason. The type has
   * to bring its imports with it.
   */
  private static typeDependencies(
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
                ? ComponentDecoratorMigration.specifierOf(decl)
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
  private static hasUnresolvedName(type: ts.TypeNode, checker: ts.TypeChecker): boolean {
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
  private static specifierOf(decl: ts.Declaration): string | null {
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
  private static membersOf(
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

  /** The `state = { … }` initialiser's per-key source text, so `@state` fields keep their real defaults. */
  private static stateInitialisers(cls: ts.ClassDeclaration): Map<string, string> {
    const out = new Map<string, string>();
    for (const member of cls.members) {
      if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) continue;
      if (member.name.text !== 'state' || !member.initializer) continue;
      if (!ts.isObjectLiteralExpression(member.initializer)) continue;
      for (const prop of member.initializer.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          out.set(prop.name.text, prop.initializer.getText());
        } else if (ts.isShorthandPropertyAssignment(prop)) {
          out.set(prop.name.text, prop.name.text);
        }
      }
    }
    return out;
  }

  /** A sensible initial value when the class had no `state = { … }` entry for a field. */
  private static defaultFor(type: string): string {
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
  private static withoutRedundantCast(init: string, type: string): string {
    const cast = /^(.*?)\s+as\s+(.+)$/s.exec(init.trim());
    return cast && cast[2].trim() === type.trim() ? cast[1].trim() : init;
  }

  /** Why the class cannot be rewritten field-by-field, or null when it can. */
  private static unrewritableReason(cls: ts.ClassDeclaration): string | null {
    let blocked: string | null = null;
    const visit = (node: ts.Node): void => {
      if (blocked) return;
      // `{...this.props}` / `Object.keys(this.state)` — whole-bag uses have no per-field equivalent.
      if (ts.isSpreadAssignment(node) || ts.isSpreadElement(node)) {
        const text = node.expression.getText();
        if (text === 'this.props' || text === 'this.state') { blocked = `spreads ${text}`; return; }
      }
      // `this.setState((current) => ({ draft: { ...current.draft } }))` — the updater's parameter IS the
      // state bag. With the generics gone it degrades to `Record<string, unknown>`, so every read off it
      // becomes `unknown` ("Spread types may only be created from object types"). The field form is
      // `this.draft = { ...this.draft }`, but rewriting an arbitrary updater body is a semantic change.
      if (ComponentDecoratorMigration.functionalSetState(node)) {
        // The SIMPLE form — an arrow whose body is just an object literal — is mechanical:
        // `setState((p) => ({ a: p.a + 1 }))` is exactly `this.a = this.a + 1`. Anything else (a block
        // body, a conditional return) is a semantic rewrite and still blocks.
        if (!ComponentDecoratorMigration.simpleUpdater(node)) {
          blocked = 'uses the functional setState(prev => …) form';
          return;
        }
      }
      if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword) {
        const name = node.name.text;
        if (name === 'props' || name === 'state') {
          const parent = node.parent;
          const ok = (ts.isPropertyAccessExpression(parent) && parent.expression === node)
            || (ts.isVariableDeclaration(parent) && parent.initializer === node
                && ts.isObjectBindingPattern(parent.name));
          if (!ok) { blocked = `passes this.${name} around whole`; return; }
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(cls, visit);
    return blocked;
  }

  /** True when the rewritten text is syntactically valid TypeScript. */
  private static parses(source: string, file: string): boolean {
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    return !(parsed as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics?.length;
  }

  /**
   * Names the BASE class already provides. A `@prop api` shadowing `PluginComponent`'s `api` getter is
   * TS2610 at best and a silently dead accessor at worst — and reactor throws on the React-owned ones
   * (`props`, `state`, `context`, `refs`) at decoration time. A collision means the component must be
   * converted by hand, so the class is skipped rather than broken.
   */
  private static inheritedNames(base: ts.ExpressionWithTypeArguments, checker: ts.TypeChecker): Set<string> | null {
    const symbol = checker.getSymbolAtLocation(base.expression);
    const resolved = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const inherited = resolved
      ? checker.getDeclaredTypeOfSymbol(resolved).getApparentProperties().map((p) => p.name)
      : [];
    // FAIL CLOSED. An unresolved base answers "inherits nothing", which reads as "every name is free" —
    // that is how a `@prop isDark` came to shadow ThemeComponent's `isDark` accessor. No type, no proof,
    // no conversion.
    if (!inherited.length) return null;
    return new Set([...inherited, 'props', 'state', 'context', 'refs', 'setState', 'forceUpdate', 'render']);
  }

  /**
   * True when the class compares `prevProps`/`prevState` against current values.
   *
   * Dropping the generics makes `this.props` an opaque `Record<string, unknown>`, so a
   * `componentDidUpdate(prev: IFooProps)` override no longer matches its base signature and every read
   * off `prev` becomes `unknown`. The correct destination is reactor's `@watch(...keys)`, which is a
   * SEMANTIC rewrite of the guard — not something this migration should guess at. Left for hand work.
   */
  private static comparesPreviousValues(cls: ts.ClassDeclaration): boolean {
    return cls.members.some((member) => ts.isMethodDeclaration(member)
      && ts.isIdentifier(member.name)
      && ['componentDidUpdate', 'shouldComponentUpdate', 'getSnapshotBeforeUpdate'].includes(member.name.text)
      && member.parameters.length > 0);
  }

  /** Members the class already declares, so the migration never emits a duplicate. */
  private static declaredNames(cls: ts.ClassDeclaration): Set<string> {
    const out = new Set<string>();
    for (const member of cls.members) {
      // Accessors count. `private get row() { return this.props.row || {}; }` alongside an emitted
      // `@prop row` is a duplicate declaration — and the getter body rewrites to `this.row`, which is
      // infinite recursion at runtime. A collision means hand conversion, never a silent merge.
      if ((ts.isPropertyDeclaration(member) || ts.isMethodDeclaration(member)
           || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member))
          && member.name && ts.isIdentifier(member.name)) out.add(member.name.text);
    }
    return out;
  }

  private static walk(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const name of entries) {
      if (ComponentDecoratorMigration.SKIP_DIRS.has(name)) continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) ComponentDecoratorMigration.walk(full, out);
      else if (/\.tsx?$/.test(full) && !full.endsWith('.d.ts')) out.push(full);
    }
    return out;
  }

  /**
   * Convert every eligible component under `target`.
   * Returns the per-file edits; pass `apply: false` to preview without writing.
   */
  static run(
    target: string,
    framework: string,
    apply = true,
  ): { converted: string[]; skipped: number; reasons: Map<string, number> } {
    const reasons = new Map<string, number>();
    function note(why: string): void { reasons.set(why, (reasons.get(why) ?? 0) + 1); }
    if (!existsSync(target)) return { converted: [], skipped: 0, reasons };
    const files = ComponentDecoratorMigration.walk(target);
    // The SAME resolution the workspace typecheck uses. With only a `baseUrl`, `@fromcode119/sdk/react`
    // does not resolve, so `PluginComponent` has no type — and every question asked of it (what members
    // does it inherit? is this interface real?) answers "nothing", which reads as "safe to convert".
    const shared = WorkspaceTypecheck.compilerOptions(framework) as { paths: Record<string, string[]> };
    // A theme resolves its own source through `@theme/*` (installed by the shared Vite config). Without
    // it the theme's imports — including its base component — do not resolve, and an unresolved base
    // silently answers "inherits nothing", which let a `@prop isDark` shadow ThemeComponent's accessor.
    const theme = /(.*[\\/]themes[\\/][^\\/]+)/.exec(target)?.[1];
    const { options } = ts.convertCompilerOptionsFromJson({
      ...shared,
      paths: { ...(theme ? { '@theme/*': [path.join(theme, 'src', '*')] } : {}), ...shared.paths },
    }, target);
    const program = ts.createProgram(files, { ...options, noEmit: true });
    const checker = program.getTypeChecker();

    const converted: string[] = [];
    let skipped = 0;

    for (const file of files) {
      const source = program.getSourceFile(file);
      if (!source) continue;
      const text = source.getFullText();
      const edits: Array<{ start: number; end: number; replacement: string }> = [];
      const carried = new Map<string, string>();
      // Per CLASS, not per file: one file can hold a converted component and a skipped one, and the
      // skipped one still owns its props bag. A file-wide set rewrote its reads too.
      const rewritten: Array<{ cls: ts.ClassDeclaration; slots: Set<'props' | 'state'> }> = [];
      let rewritable = new Set<'props' | 'state'>();

      for (const stmt of source.statements) {
        if (!ts.isClassDeclaration(stmt) || !stmt.heritageClauses) continue;
        const heritage = stmt.heritageClauses.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword);
        const base = heritage?.types[0];
        if (!base || !ts.isIdentifier(base.expression)) continue;
        if (!ComponentDecoratorMigration.bases().has(base.expression.text)) continue;
        if (!base.typeArguments?.length) continue;
        const blocked = ComponentDecoratorMigration.unrewritableReason(stmt);
        if (blocked) { skipped += 1; note(blocked); continue; }
        if (stmt.members.some(ts.isConstructorDeclaration)) {
          skipped += 1;
          note('declares its own constructor — convert the binding to @bound by hand');
          continue;
        }
        if (ComponentDecoratorMigration.comparesPreviousValues(stmt)
            && !ComponentDecoratorMigration.simpleDidUpdate(stmt)) {
          skipped += 1;
          note('compares prevProps/prevState — needs a @watch rewrite by hand');
          continue;
        }
        const inherited = ComponentDecoratorMigration.inheritedNames(base, checker);
        if (!inherited) {
          skipped += 1;
          note(`base class '${base.expression.getText()}' did not resolve — cannot prove no collision`);
          continue;
        }

        const already = ComponentDecoratorMigration.declaredNames(stmt);
        const inits = ComponentDecoratorMigration.stateInitialisers(stmt);
        const [propsType, stateType] = base.typeArguments;
        const decls: string[] = [];
        const needed = new Map<string, string>();
        const emitted: Record<'props' | 'state', Set<string>> = { props: new Set(), state: new Set() };
        let bad = false;

        for (const [index, node] of [propsType, stateType].entries()) {
          if (!node) continue;
          const asText = node.getText();
          // A bag with no members carries nothing to declare — that slot is simply dropped.
          // This MUST be tested before the generic guard below: `Record<string, unknown>` is itself a
          // parameterised type reference, so the guard used to bail on the single commonest shape in the
          // tree — `extends PluginComponent<Record<string, unknown>, ISomeState>`, i.e. "no props, real
          // state" — and 78 classes were reported unsafe that are entirely safe.
          if (['Record<string, unknown>', 'any', '{}', 'unknown', 'object'].includes(asText)) continue;
          // `IProps<T>` puts the class's own type PARAMETER in its member types. Moved onto the class,
          // `T` names nothing — and the import carried for it resolves to a member that does not exist.
          if (ts.isTypeReferenceNode(node) && node.typeArguments?.length) {
            bad = true;
            note(`generic props/state '${node.getText().slice(0, 40)}'`);
            break;
          }
          const members = ComponentDecoratorMigration.membersOf(node, checker);
          if (!members) {
            bad = true;
            note(ts.isTypeReferenceNode(node)
              ? `unresolved interface '${node.getText()}'`
              : `unsupported type '${node.getText().slice(0, 40)}'`);
            break;
          }
          for (const m of members) {
            // A name carried by BOTH props and state is TWO distinct values — `this.row` cannot be both.
            // Declaring one and dropping the other silently changes which value the component reads
            // (it quietly narrowed a `ThemeMode | 'light' | 'dark'` state to the prop of the same name).
            if (index === 1 && emitted.props.has(m.name)) {
              bad = true;
              note(`'${m.name}' is both a prop and a state field`);
              break;
            }
            if (already.has(m.name)) {
              bad = true;
              note(`'${m.name}' already declared on the class`);
              break;
            }
            already.add(m.name);
            emitted[index === 0 ? 'props' : 'state'].add(m.name);
            if (ComponentDecoratorMigration.hasUnresolvedName(m.node, checker)) {
              bad = true;
              note(`'${m.name}' names an undeclared type — fix the interface first`);
              break;
            }
            if (m.type.includes('import(')) {
              bad = true;
              note('member type uses an inline import() path');
              break;
            }
            if (inherited.has(m.name)) {
              bad = true;
              note(`'${m.name}' collides with a base-class member`);
              break;
            }
            for (const [name, spec] of ComponentDecoratorMigration.typeDependencies(m.node, checker)) {
              needed.set(name, spec);
            }
            const init = inits.get(m.name) ?? ComponentDecoratorMigration.defaultFor(m.type);
            // `!`, never `declare`. esbuild — which builds every plugin and theme bundle — rejects a
            // decorator on an ambient field ("Decorators are not valid here") and the whole UI bundle
            // fails. The definite-assignment form is what plugin components already use and compiles in
            // both toolchains; under `useDefineForClassFields: false` neither emits a shadowing field.
            decls.push(index === 0
              ? `  @prop ${m.name}${m.optional ? '?' : '!'}: ${m.type};`
              : `  @state ${m.name}: ${m.type} = ${ComponentDecoratorMigration.withoutRedundantCast(init, m.type)};`);
          }
        }
        if (bad) {
          skipped += 1;
          continue;
        }
        // No members left to declare means every one is ALREADY a field — the generic argument list is
        // pure leftover, so drop it and emit nothing. Treating that as "unsafe" left 27 appearance
        // components carrying `<Props, State>` they no longer used.
        if (!decls.length) note('generics dropped (members already fields)');

        for (const [name, spec] of needed) carried.set(name, spec);

        // Drop the generics. The span runs from the `<` to the REAL closing `>` — on a multi-line
        // argument list the closer sits past whitespace/newlines, so `typeArguments.end + 1` cuts short
        // and leaves a stray `>` welded to the base class (`extends PluginComponent> {`).
        edits.push({
          start: base.expression.end,
          end: text.indexOf('>', base.typeArguments.end) + 1,
          replacement: '',
        });
        if (decls.length) {
          const brace = stmt.members.pos;
          edits.push({ start: brace, end: brace, replacement: `\n${decls.join('\n')}` });
        }

        // `componentDidUpdate` + a prevProps/prevState comparison IS a `@watch` — the decorator fires on
        // exactly the keys the guard tested, so the guard itself disappears with it.
        const plan = ComponentDecoratorMigration.didUpdatePlan(stmt);
        if (plan) {
          const watched = plan.keys.map((k) => `'${k}'`).join(', ');
          const name = `on${plan.keys[0].charAt(0).toUpperCase()}${plan.keys[0].slice(1)}Changed`;
          edits.push({
            start: plan.method.getStart(source),
            end: plan.method.end,
            replacement: `@watch(${watched})\n  protected ${name}(): void {\n    ${plan.body.split('\n').join('\n  ').trim()}\n  }`,
          });
          carried.set('watch', 'watch');
        }

        // Remove the `state = { … }` bag ONLY when state fields replaced it. A class whose state slot was
        // an opaque `Record<string, unknown>` emits no fields, so deleting its bag left every `this.x`
        // read pointing at nothing (`Property 'options' does not exist`).
        for (const member of emitted.state.size ? stmt.members : []) {
          if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name)
              && member.name.text === 'state' && member.initializer) {
            // From the START OF ITS LINE, not `member.pos`. A node's `pos` includes leading trivia, so for
            // the class's FIRST member it equals `members.pos` — the very offset the new fields are
            // inserted at. The two ranges then overlapped and the removal deleted the inserted text
            // instead of the declaration (`extends PluginComponent {, unknown> | null = null;`).
            const start = text.lastIndexOf('\n', member.getStart()) + 1;
            const end = text[member.end] === '\n' ? member.end + 1 : member.end;
            edits.push({ start, end, replacement: '' });
          }
        }
        const slots = new Set<'props' | 'state'>();
        for (const slot of ['props', 'state'] as const) if (emitted[slot].size) slots.add(slot);
        rewritten.push({ cls: stmt, slots });
      }

      if (!rewritten.length) continue;

      // rewrite reads: this.props.x / this.state.x -> this.x, and bag destructuring -> this
      const rewriteReads = (node: ts.Node): void => {
        if (ts.isPropertyAccessExpression(node)
            && ts.isPropertyAccessExpression(node.expression)
            && node.expression.expression.kind === ts.SyntaxKind.ThisKeyword
            && rewritable.has(node.expression.name.text as 'props' | 'state')) {
          edits.push({ start: node.expression.name.pos - 1, end: node.expression.name.end, replacement: '' });
        }
        if (ts.isVariableDeclaration(node) && node.initializer
            && ts.isObjectBindingPattern(node.name)
            && ts.isPropertyAccessExpression(node.initializer)
            && node.initializer.expression.kind === ts.SyntaxKind.ThisKeyword
            && rewritable.has(node.initializer.name.text as 'props' | 'state')) {
          edits.push({ start: node.initializer.name.pos - 1, end: node.initializer.name.end, replacement: '' });
        }
        ts.forEachChild(node, rewriteReads);
      };
      // ONLY inside the classes that were actually converted. Walking the whole SOURCE FILE rewrote
      // `this.props.x` in classes that had been SKIPPED — they still have a props bag, so the rewrite
      // pointed at fields that do not exist (`Property 'id' does not exist on type 'BlockWrapperCore'`).
      for (const { cls, slots } of rewritten) {
        rewritable = slots;
        ts.forEachChild(cls, rewriteReads);
      }

      let out = text;
      for (const edit of edits.sort((a, b) => b.start - a.start)) {
        out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end);
      }
      out = ComponentDecoratorMigration.rewriteFunctionalSetState(out, file);
      out = ComponentDecoratorMigration.ensureDecoratorImport(out, file);
      out = ComponentDecoratorMigration.ensureTypeImports(out, file, carried);

      // A rewrite that does not PARSE is never written. Overlapping edit ranges silently produced
      // `extends PluginComponent {, unknown> | null = null;` across 229 files, and a syntax error also
      // suppresses the rest of a file's diagnostics — so a corrupt file can make an error count FALL.
      // This is the one check that cannot be fooled by that.
      if (!ComponentDecoratorMigration.parses(out, file)) {
        skipped += 1;
        note('rewrite did not re-parse — file left untouched');
        continue;
      }
      if (apply) writeFileSync(file, out, 'utf8');
      converted.push(file);
    }
    return { converted, skipped, reasons };
  }

  /**
   * Adds a type-only import for every name a moved member's type mentions that the target file does not
   * already have. An absolute specifier (the type was declared in, or imported relatively by, another
   * file) is re-based against the target's directory; a package/alias specifier is used verbatim.
   */
  private static ensureTypeImports(source: string, file: string, carried: Map<string, string>): string {
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

  /** Adds `prop`/`state` to the existing reactor/sdk import, or a new import when there is none. */
  /**
   * Add the decorator import, from the RIGHT package for where the file lives.
   *
   * Framework packages import `@fromcode119/reactor` directly. A PLUGIN, THEME or APPEARANCE bundle must
   * take them from `@fromcode119/sdk/react` instead — reactor is republished through the SDK bridge, and
   * a bare `@fromcode119/reactor` specifier is not externalised for those builds: Rollup fails with
   * "failed to resolve import" and the whole theme build dies.
   */
  /** `this.setState(<function>)` — the updater form, whatever its body. */
  /**
   * The `componentDidUpdate` shapes a `@watch` can express exactly:
   *
   *   componentDidUpdate(prev) { if (prev.a !== this.props.a) BODY }            // guard-then-body
   *   componentDidUpdate(prev) { if (prev.a === this.props.a) return; BODY }    // early-return
   *
   * Every compared key must be a plain `prev.<key>` vs `this.props.<key>` (or state) pair — anything
   * else (a computed comparison, a nested access, a mix with unrelated conditions) still needs a human.
   */
  private static simpleDidUpdate(cls: ts.ClassDeclaration): boolean {
    return ComponentDecoratorMigration.didUpdatePlan(cls) !== null;
  }

  /** The watched keys and the body to move, or null when the method is not one of the two shapes. */
  private static didUpdatePlan(cls: ts.ClassDeclaration): { keys: string[]; body: string; method: ts.MethodDeclaration } | null {
    const method = cls.members.find((m): m is ts.MethodDeclaration =>
      ts.isMethodDeclaration(m) && ts.isIdentifier(m.name) && m.name.text === 'componentDidUpdate');
    if (!method?.body || !method.parameters.length) return null;
    const paramNames = method.parameters
      .filter((param) => ts.isIdentifier(param.name))
      .map((param) => (param.name as ts.Identifier).text);
    const statements = method.body.statements;
    if (statements.length === 0) return null;
    const first = statements[0];
    if (!ts.isIfStatement(first) || first.elseStatement) return null;

    const keys: string[] = [];
    let negated: boolean | null = null;
    const walk = (expr: ts.Expression): boolean => {
      if (ts.isBinaryExpression(expr)) {
        const op = expr.operatorToken.kind;
        if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) {
          return walk(expr.left) && walk(expr.right);
        }
        const isEq = op === ts.SyntaxKind.EqualsEqualsEqualsToken;
        const isNe = op === ts.SyntaxKind.ExclamationEqualsEqualsToken;
        if (!isEq && !isNe) return false;
        if (negated === null) negated = isEq;
        else if (negated !== isEq) return false;
        const sides = [expr.left, expr.right].map((side) => side.getText());
        const prevSide = sides.find((t) => paramNames.some((n) => t.startsWith(`${n}.`)));
        const ownSide = sides.find((t) => t.startsWith('this.props.') || t.startsWith('this.state.'));
        if (!prevSide || !ownSide) return false;
        const key = prevSide.slice(prevSide.indexOf('.') + 1);
        if (!/^[A-Za-z_$][\w$]*$/.test(key)) return false;
        if (ownSide.split('.').pop() !== key) return false;
        keys.push(key);
        return true;
      }
      return false;
    };
    if (!walk(first.expression) || !keys.length) return null;

    // `if (same) return;` + trailing body, or `if (changed) { body }` with nothing after it.
    const isEarlyReturn = ts.isReturnStatement(first.thenStatement)
      || (ts.isBlock(first.thenStatement) && first.thenStatement.statements.length === 1
          && ts.isReturnStatement(first.thenStatement.statements[0]));
    if (isEarlyReturn) {
      if (negated !== true || statements.length < 2) return null;
      const rest = statements.slice(1);
      const text = method.getSourceFile().text;
      return { keys, body: text.slice(rest[0].getStart(method.getSourceFile()), rest[rest.length - 1].end), method };
    }
    if (negated !== false || statements.length !== 1) return null;
    const block = first.thenStatement;
    if (!ts.isBlock(block) || !block.statements.length) return null;
    const text = method.getSourceFile().text;
    return {
      keys,
      body: text.slice(block.statements[0].getStart(method.getSourceFile()), block.statements[block.statements.length - 1].end),
      method,
    };
  }

  private static functionalSetState(node: ts.Node): node is ts.CallExpression {
    return ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.kind === ts.SyntaxKind.ThisKeyword
      && node.expression.name.text === 'setState'
      && node.arguments.length > 0
      && (ts.isArrowFunction(node.arguments[0]) || ts.isFunctionExpression(node.arguments[0]));
  }

  /**
   * True when the updater is `(prev) => ({ … })` with a plain object-literal body whose every property is
   * a simple `name: value` — the only shape that maps 1:1 onto field assignments.
   *
   * A computed key (`[name]: v`), a spread of the whole bag, or a shorthand is refused: those need to know
   * what the bag contains, which is the thing being removed.
   */
  private static simpleUpdater(call: ts.CallExpression): boolean {
    const fn = call.arguments[0];
    if (!ts.isArrowFunction(fn) || fn.parameters.length !== 1) return false;
    const param = fn.parameters[0];
    if (!ts.isIdentifier(param.name)) return false;
    const body = ts.isParenthesizedExpression(fn.body) ? fn.body.expression : fn.body;
    if (!ts.isObjectLiteralExpression(body)) return false;
    return body.properties.every((prop) => ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name));
  }

  /**
   * Rewrite every simple functional `setState` into direct field assignments.
   *
   * `this.setState((p) => ({ a: p.a + 1, b: true }))` becomes `this.a = this.a + 1; this.b = true;` —
   * with `@state` the assignment IS the update, and reading `this.a` inside it reads the current value,
   * which is exactly what the updater's parameter gave.
   */
  private static rewriteFunctionalSetState(source: string, file: string): string {
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const edits: Array<{ start: number; end: number; replacement: string }> = [];
    const visit = (node: ts.Node): void => {
      if (ComponentDecoratorMigration.functionalSetState(node) && ComponentDecoratorMigration.simpleUpdater(node)) {
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

  private static ensureDecoratorImport(source: string, file = ''): string {
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
