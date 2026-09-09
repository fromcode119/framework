import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { WorkspaceTypecheck } from '../workspace-typecheck';
import { ComponentClassAnalyzer } from './component-class-analyzer';
import { ComponentSourceRewriter } from './component-source-rewriter';
import { ComponentTypeAnalyzer } from './component-type-analyzer';

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
        const blocked = ComponentClassAnalyzer.unrewritableReason(stmt);
        if (blocked) { skipped += 1; note(blocked); continue; }
        if (stmt.members.some(ts.isConstructorDeclaration)) {
          skipped += 1;
          note('declares its own constructor — convert the binding to @bound by hand');
          continue;
        }
        if (ComponentClassAnalyzer.comparesPreviousValues(stmt)
            && !ComponentClassAnalyzer.simpleDidUpdate(stmt)) {
          skipped += 1;
          note('compares prevProps/prevState — needs a @watch rewrite by hand');
          continue;
        }
        const inherited = ComponentClassAnalyzer.inheritedNames(base, checker);
        if (!inherited) {
          skipped += 1;
          note(`base class '${base.expression.getText()}' did not resolve — cannot prove no collision`);
          continue;
        }

        const already = ComponentClassAnalyzer.declaredNames(stmt);
        const inits = ComponentClassAnalyzer.stateInitialisers(stmt);
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
          const members = ComponentTypeAnalyzer.membersOf(node, checker);
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
            if (ComponentTypeAnalyzer.hasUnresolvedName(m.node, checker)) {
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
            for (const [name, spec] of ComponentTypeAnalyzer.typeDependencies(m.node, checker)) {
              needed.set(name, spec);
            }
            const init = inits.get(m.name) ?? ComponentTypeAnalyzer.defaultFor(m.type);
            // `!`, never `declare`. esbuild — which builds every plugin and theme bundle — rejects a
            // decorator on an ambient field ("Decorators are not valid here") and the whole UI bundle
            // fails. The definite-assignment form is what plugin components already use and compiles in
            // both toolchains; under `useDefineForClassFields: false` neither emits a shadowing field.
            decls.push(index === 0
              ? `  @prop ${m.name}${m.optional ? '?' : '!'}: ${m.type};`
              : `  @state ${m.name}: ${m.type} = ${ComponentTypeAnalyzer.withoutRedundantCast(init, m.type)};`);
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
        const plan = ComponentClassAnalyzer.didUpdatePlan(stmt);
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
      out = ComponentSourceRewriter.rewriteFunctionalSetState(out, file);
      out = ComponentSourceRewriter.ensureDecoratorImport(out, file);
      out = ComponentSourceRewriter.ensureTypeImports(out, file, carried);

      // A rewrite that does not PARSE is never written. Overlapping edit ranges silently produced
      // `extends PluginComponent {, unknown> | null = null;` across 229 files, and a syntax error also
      // suppresses the rest of a file's diagnostics — so a corrupt file can make an error count FALL.
      // This is the one check that cannot be fooled by that.
      if (!ComponentClassAnalyzer.parses(out, file)) {
        skipped += 1;
        note('rewrite did not re-parse — file left untouched');
        continue;
      }
      if (apply) writeFileSync(file, out, 'utf8');
      converted.push(file);
    }
    return { converted, skipped, reasons };
  }
}
