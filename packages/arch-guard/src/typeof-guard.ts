import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { WorkspaceTypecheck } from './workspace-typecheck';

/**
 * A `typeof x === 'string' | 'number' | 'boolean' | 'function'` check whose answer is ALREADY DECIDED
 * by the operand's type.
 *
 * WHAT CHANGED, and why it matters. This guard used to be a regex over every such comparison and
 * reported 595 of them. Reading a sample showed what they actually were: a Proxy trap narrowing
 * `string | symbol`, a `SetStateAction<T>` being told apart from `T`, a parsed JSON body being
 * narrowed out of `unknown`. TypeScript has no other form for any of those, so the "fix" would have
 * been to break working code. The guard's own history says this out loud — it had already dropped
 * `'object'` and `'symbol'` because "counting them made the guard report 491 findings with no
 * available fix, which is how a guard becomes noise". The same was true of what was left.
 *
 * So it asks the CHECKER instead, and reports only what the convention actually bans:
 *
 *   report    the operand's type settles the comparison — one branch is unreachable. That is the
 *             dead contract guard CLAUDE.md is about (`typeof context.auth.guard === 'function'`).
 *   allow     the operand is `any`/`unknown`/`{}` — untrusted input, and the check IS the narrowing.
 *   allow     the operand is a real union that includes the tested type — same.
 *   allow     the operand carries an `as` assertion — the author is asserting a shape the runtime may
 *             not have (thenable detection, duck-typing a `Response`). The check is about the VALUE.
 *   allow     the operand is declared by the PLATFORM's own typings (lib.dom, @types/node) —
 *             `requestIdleCallback`, `window.matchMedia`, `headers.getSetCookie`. The type says it
 *             always exists; the runtime is where it does not. That is feature detection.
 *
 * That took 595 to 25, every one of them real, and all 25 were fixed. Most were not deletions: the
 * SIGNATURE was lying — a parameter typed `number` that a plugin calls across the SDK boundary with
 * whatever it likes — so the type was widened and the check became honest narrowing.
 *
 * `typeof x === 'undefined'` is still never reported: an existence check has no better form.
 */
export class TypeofGuard {
  /** The primitives the convention names. `'object'`/`'symbol'`/`'undefined'` are narrowing, not guards. */
  private static readonly TESTED = new Set(['string', 'number', 'boolean', 'function']);

  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git', 'tests', '__tests__',
  ]);

  /**
   * `reactor` / `next-build-codegen` / `typor` are the standalone layer that confines raw JS/TS
   * mechanics — a runtime type check is sometimes genuinely their job, and they cannot import the SDK
   * to avoid it.
   */
  private static readonly EXEMPT_PACKAGES = new Set([
    'react-class-components', 'next-build-codegen', 'typescript-multiple-inheritance',
  ]);

  private static files(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      if (statSync(full, { throwIfNoEntry: false })?.isDirectory()) {
        if (TypeofGuard.SKIP_DIR.has(entry) || TypeofGuard.EXEMPT_PACKAGES.has(entry)) continue;
        TypeofGuard.files(full, out);
      } else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  /** Is this symbol declared by TypeScript's own libs or by `@types/*` rather than by this repository? */
  private static isPlatformDeclared(operand: ts.Node, checker: ts.TypeChecker): boolean {
    let symbol: ts.Symbol | undefined;
    try { symbol = checker.getSymbolAtLocation(operand); } catch { return false; }
    for (const declaration of symbol?.declarations ?? []) {
      const file = declaration.getSourceFile().fileName.replace(/\\/g, '/');
      // ANY declaration that is not ours: TypeScript's own libs, `@types/*`, and packages that ship
      // their own typings (`undici-types` declares `Headers.getSetCookie`, which exists on Node 20
      // and not on 18). We do not own those runtimes, so their presence is a fact about the machine.
      if (file.includes('/node_modules/')) return true;
    }
    return false;
  }

  /** The two sides of a `typeof x === '<primitive>'`, either way round. */
  private static typeofComparison(node: ts.BinaryExpression): { operand: ts.Expression; tested: string } | null {
    const equality = [
      ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
    ];
    if (!equality.includes(node.operatorToken.kind)) return null;
    for (const [a, b] of [[node.left, node.right], [node.right, node.left]] as const) {
      if (ts.isTypeOfExpression(a) && ts.isStringLiteral(b) && TypeofGuard.TESTED.has(b.text)) {
        return { operand: a.expression, tested: b.text };
      }
    }
    return null;
  }

  /** Every check whose answer the operand's own type already settles, per area. */
  static scan(roots: readonly { area: string; dir: string }[]): {
    counts: Record<string, number>;
    detail: { area: string; file: string; hits: string[] }[];
  } {
    const counts: Record<string, number> = {};
    const detail: { area: string; file: string; hits: string[] }[] = [];

    for (const { area, dir } of roots) {
      counts[area] = counts[area] ?? 0;
      const files = TypeofGuard.files(dir);
      if (!files.length) continue;

      const framework = path.resolve(dir, '..');
      const options = TypeofGuard.optionsFor(area, framework);
      const program = ts.createProgram(files, options);
      const checker = program.getTypeChecker();
      const wanted = new Set(files);
      const perFile = new Map<string, string[]>();

      for (const source of program.getSourceFiles()) {
        if (!wanted.has(source.fileName)) continue;
        const visit = (node: ts.Node): void => {
          if (ts.isBinaryExpression(node)) {
            const comparison = TypeofGuard.typeofComparison(node);
            if (comparison && TypeofGuard.isSettled(comparison.operand, checker)) {
              const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
              const hits = perFile.get(source.fileName) ?? [];
              // The TYPE is the finding — it is what says the branch is unreachable.
              const settled = checker.typeToString(checker.getTypeAtLocation(comparison.operand));
              hits.push(`${line}: ${node.getText().replace(/\s+/g, ' ').slice(0, 70)}   [${settled.slice(0, 40)}]`);
              perFile.set(source.fileName, hits);
            }
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }

      for (const [file, hits] of perFile) {
        counts[area] += hits.length;
        detail.push({ area, file, hits });
      }
    }
    return { counts, detail };
  }

  /**
   * The compiler settings this area is really built with.
   *
   * STRICTNESS IS LOAD-BEARING HERE, in a way it is not for the other guards. The framework compiles
   * with `strict: true`, so an optional member is `T | undefined` — a UNION, and narrowing it is
   * legitimate. `WorkspaceTypecheck.compilerOptions` deliberately sets `strict: false` because it
   * checks EXTENSION source, and under that setting the same member collapses to `T` and every one of
   * those honest checks reads as a dead guard. Measured: 34 reported against the loose options, 0
   * against the framework's own.
   */
  private static optionsFor(area: string, framework: string): ts.CompilerOptions {
    if (area !== 'framework') {
      const { options } = ts.convertCompilerOptionsFromJson(
        { ...WorkspaceTypecheck.compilerOptions(framework), noEmit: true }, framework,
      );
      return options;
    }
    // `parsed.options`, never `parsed.raw.compilerOptions`: the parsed form has `baseUrl` and every
    // `paths` entry already resolved to an absolute path. Re-converting the raw JSON leaves them
    // relative, `@core/*` stops resolving, and the checker then answered `never` for a parameter that
    // is plainly `unknown` — reporting two correct narrowings as dead branches.
    const read = ts.readConfigFile(path.join(framework, 'tsconfig.json'), ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(read.config ?? {}, ts.sys, framework);
    return { ...parsed.options, noEmit: true, skipLibCheck: true };
  }

  /** Does the operand's own type already decide the comparison? See this class's note for the four allowances. */
  private static isSettled(operand: ts.Expression, checker: ts.TypeChecker): boolean {
    let type: ts.Type | null = null;
    try { type = checker.getTypeAtLocation(operand); } catch { return false; }
    if (!type) return false;
    const name = checker.typeToString(type);
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return false;
    if (name === '{}' || name === 'object') return false;
    // `never` is not a finding, it is a SYMPTOM of this program disagreeing with the real build.
    // Measured: `LocalizationUtils.toLocaleMap(value: unknown)` reads as `unknown` to the package's
    // own `tsc` — which compiles, and would not if the parameter were `never` — and as `never` here.
    // Reporting it would have condemned two correct narrowings on the strength of a resolution
    // difference this guard cannot see.
    if (type.flags & ts.TypeFlags.Never) return false;
    if (type.isUnion()) return false;
    if (/\bas\s+[A-Z]/.test(operand.getText())) return false;
    return !TypeofGuard.isPlatformDeclared(operand, checker);
  }
}
