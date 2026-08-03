import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';

type LoadResult = { contents: string; loader: string } | undefined;
type BuildLike = {
  onLoad(options: { filter: RegExp }, callback: (args: { path: string }) => Promise<LoadResult>): void;
};
type PluginLike = { name: string; setup(build: BuildLike): void };
type Hit = { start: number; end: number; value: string };

/**
 * Resolves `@template('./card.view')` at build time: rewrites the string path into a real import so the
 * reactor `template` decorator receives the compiled view function (not a string). The component then needs
 * NO `import` and NO `render()`/`view =` line — just the decorator with a path.
 *
 * AST-based (@babel/parser): only actual `@template(...)` DECORATOR nodes are rewritten — a `@template('…')`
 * appearing inside a string or comment is left alone. Place BEFORE ViewPlugin/ViewPairPlugin.
 */
export class TemplateDecoratorPlugin {
  static readonly filenamePattern = /\.(t|j)sx?$/;

  /** Rewrite each real `@template('path')` decorator to `@template(<importedIdentifier>)` + hoist imports. */
  static transform(source: string): string | null {
    let ast: unknown;
    try {
      ast = parse(source, {
        sourceType: 'module',
        errorRecovery: true,
        plugins: ['jsx', 'typescript', 'decorators-legacy'],
      });
    } catch {
      return null;
    }
    const hits: Hit[] = [];
    TemplateDecoratorPlugin.collect(ast, hits);
    if (hits.length === 0) return null;

    hits.sort((a, b) => a.start - b.start);
    const imports = hits.map((hit, i) => `import __reactorTemplate_${i} from ${JSON.stringify(hit.value)};`);

    let out = source;
    for (let i = hits.length - 1; i >= 0; i -= 1) {
      out = out.slice(0, hits[i].start) + `__reactorTemplate_${i}` + out.slice(hits[i].end);
    }
    return `${imports.join('\n')}\n${out}`;
  }

  private static collect(node: unknown, hits: Hit[]): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) TemplateDecoratorPlugin.collect(child, hits);
      return;
    }
    const record = node as Record<string, any>;
    if (record['type'] === 'Decorator') {
      const call = record['expression'];
      const isTemplate = call?.type === 'CallExpression' && call.callee?.type === 'Identifier' && call.callee.name === 'template';
      const arg = call?.arguments?.[0];
      if (isTemplate && arg?.type === 'StringLiteral' && typeof arg.start === 'number' && typeof arg.end === 'number') {
        hits.push({ start: arg.start, end: arg.end, value: arg.value as string });
      }
    }
    for (const key of Object.keys(record)) {
      if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
      TemplateDecoratorPlugin.collect(record[key], hits);
    }
  }

  static esbuild(): PluginLike {
    return {
      name: 'nextor-template-decorator',
      setup(build: BuildLike): void {
        build.onLoad({ filter: TemplateDecoratorPlugin.filenamePattern }, async (args) => {
          const transformed = TemplateDecoratorPlugin.transform(await readFile(args.path, 'utf8'));
          if (transformed === null) return undefined;
          const loader = args.path.endsWith('.tsx') || args.path.endsWith('.jsx') ? 'tsx' : 'ts';
          return { contents: transformed, loader };
        });
      },
    };
  }
}
