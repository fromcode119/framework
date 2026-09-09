import ts from 'typescript';

/**
 * Reads the SHAPE of a component class: what it already declares, what it inherits, and the specific
 * constructs that make a field-by-field rewrite impossible or unnecessary.
 *
 * Split out of ComponentDecoratorMigration (765 lines) 2026-09-09. Every method answers a question
 * about one class and returns a verdict; none of them writes anything.
 */
export class ComponentClassAnalyzer {
  /** The `state = { … }` initialiser's per-key source text, so `@state` fields keep their real defaults. */
  static stateInitialisers(cls: ts.ClassDeclaration): Map<string, string> {
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


  /** Why the class cannot be rewritten field-by-field, or null when it can. */
  static unrewritableReason(cls: ts.ClassDeclaration): string | null {
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
      if (ComponentClassAnalyzer.functionalSetState(node)) {
        // The SIMPLE form — an arrow whose body is just an object literal — is mechanical:
        // `setState((p) => ({ a: p.a + 1 }))` is exactly `this.a = this.a + 1`. Anything else (a block
        // body, a conditional return) is a semantic rewrite and still blocks.
        if (!ComponentClassAnalyzer.simpleUpdater(node)) {
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
  static parses(source: string, file: string): boolean {
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
  static inheritedNames(base: ts.ExpressionWithTypeArguments, checker: ts.TypeChecker): Set<string> | null {
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
  static comparesPreviousValues(cls: ts.ClassDeclaration): boolean {
    return cls.members.some((member) => ts.isMethodDeclaration(member)
      && ts.isIdentifier(member.name)
      && ['componentDidUpdate', 'shouldComponentUpdate', 'getSnapshotBeforeUpdate'].includes(member.name.text)
      && member.parameters.length > 0);
  }


  /** Members the class already declares, so the migration never emits a duplicate. */
  static declaredNames(cls: ts.ClassDeclaration): Set<string> {
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


  /**
   * The `componentDidUpdate` shapes a `@watch` can express exactly:
   *
   *   componentDidUpdate(prev) { if (prev.a !== this.props.a) BODY }            // guard-then-body
   *   componentDidUpdate(prev) { if (prev.a === this.props.a) return; BODY }    // early-return
   *
   * Every compared key must be a plain `prev.<key>` vs `this.props.<key>` (or state) pair — anything
   * else (a computed comparison, a nested access, a mix with unrelated conditions) still needs a human.
   */
  static simpleDidUpdate(cls: ts.ClassDeclaration): boolean {
    return ComponentClassAnalyzer.didUpdatePlan(cls) !== null;
  }


  /** The watched keys and the body to move, or null when the method is not one of the two shapes. */
  static didUpdatePlan(cls: ts.ClassDeclaration): { keys: string[]; body: string; method: ts.MethodDeclaration } | null {
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


  /** `this.setState(<function>)` — the updater form, whatever its body. */
  static functionalSetState(node: ts.Node): node is ts.CallExpression {
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
  static simpleUpdater(call: ts.CallExpression): boolean {
    const fn = call.arguments[0];
    if (!ts.isArrowFunction(fn) || fn.parameters.length !== 1) return false;
    const param = fn.parameters[0];
    if (!ts.isIdentifier(param.name)) return false;
    const body = ts.isParenthesizedExpression(fn.body) ? fn.body.expression : fn.body;
    if (!ts.isObjectLiteralExpression(body)) return false;
    return body.properties.every((prop) => ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name));
  }
}
