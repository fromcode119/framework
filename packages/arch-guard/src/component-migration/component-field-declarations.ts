import ts from 'typescript';
import { ComponentClassAnalyzer } from './component-class-analyzer';
import { ComponentTypeAnalyzer } from './component-type-analyzer';

/**
 * Turning a component's `<Props, State>` generic arguments into the `@prop` / `@state` field lines
 * that replace them.
 *
 * Every refusal here is a case where the rewrite would CHANGE what the component reads, not merely a
 * case the tool finds awkward — which is why each one carries its own reason rather than a shared
 * "unsupported". A conversion that guesses is worse than one that stops.
 */
export class ComponentFieldDeclarations {
  /** Bags that carry nothing to declare — the slot is simply dropped. */
  private static readonly EMPTY_BAGS = ['Record<string, unknown>', 'any', '{}', 'unknown', 'object'];

  /**
   * The field lines for one class, or `null` when the class cannot be converted safely.
   *
   * `note` records WHY a class was refused; the caller tallies those reasons for its report.
   */
  static derive(
    base: ts.ExpressionWithTypeArguments,
    stmt: ts.ClassDeclaration,
    inherited: ReadonlySet<string>,
    checker: ts.TypeChecker,
    note: (why: string) => void,
  ): { decls: string[]; needed: Map<string, string>; emitted: Record<'props' | 'state', Set<string>> } | null {
    const already = ComponentClassAnalyzer.declaredNames(stmt);
    const inits = ComponentClassAnalyzer.stateInitialisers(stmt);
    const [propsType, stateType] = base.typeArguments ?? [];
    const decls: string[] = [];
    const needed = new Map<string, string>();
    const emitted: Record<'props' | 'state', Set<string>> = { props: new Set(), state: new Set() };

    for (const [index, node] of [propsType, stateType].entries()) {
      if (!node) continue;
      const asText = node.getText();
      // This MUST be tested before the generic guard below: `Record<string, unknown>` is itself a
      // parameterised type reference, so the guard used to bail on the single commonest shape in the
      // tree — `extends PluginComponent<Record<string, unknown>, ISomeState>`, i.e. "no props, real
      // state" — and 78 classes were reported unsafe that are entirely safe.
      if (ComponentFieldDeclarations.EMPTY_BAGS.includes(asText)) continue;
      // `IProps<T>` puts the class's own type PARAMETER in its member types. Moved onto the class,
      // `T` names nothing — and the import carried for it resolves to a member that does not exist.
      if (ts.isTypeReferenceNode(node) && node.typeArguments?.length) {
        note(`generic props/state '${asText.slice(0, 40)}'`);
        return null;
      }
      const members = ComponentTypeAnalyzer.membersOf(node, checker);
      if (!members) {
        note(ts.isTypeReferenceNode(node)
          ? `unresolved interface '${asText}'`
          : `unsupported type '${asText.slice(0, 40)}'`);
        return null;
      }
      for (const m of members) {
        // A name carried by BOTH props and state is TWO distinct values — `this.row` cannot be both.
        // Declaring one and dropping the other silently changes which value the component reads
        // (it quietly narrowed a `ThemeMode | 'light' | 'dark'` state to the prop of the same name).
        if (index === 1 && emitted.props.has(m.name)) {
          note(`'${m.name}' is both a prop and a state field`);
          return null;
        }
        if (already.has(m.name)) {
          note(`'${m.name}' already declared on the class`);
          return null;
        }
        already.add(m.name);
        emitted[index === 0 ? 'props' : 'state'].add(m.name);
        if (ComponentTypeAnalyzer.hasUnresolvedName(m.node, checker)) {
          note(`'${m.name}' names an undeclared type — fix the interface first`);
          return null;
        }
        if (m.type.includes('import(')) {
          note('member type uses an inline import() path');
          return null;
        }
        if (inherited.has(m.name)) {
          note(`'${m.name}' collides with a base-class member`);
          return null;
        }
        for (const [name, spec] of ComponentTypeAnalyzer.typeDependencies(m.node, checker)) needed.set(name, spec);
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
    return { decls, needed, emitted };
  }
}
