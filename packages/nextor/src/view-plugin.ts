import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';

type LoadResult = { contents: string; loader: string } | undefined;
type BuildLike = {
  onLoad(options: { filter: RegExp }, callback: (args: { path: string }) => Promise<LoadResult>): void;
};
type PluginLike = { name: string; setup(build: BuildLike): void };

/**
 * JSX template compiler: a `*.view.tsx` file (suffix configurable) holds ONLY markup — bare JSX that uses
 * `this` and component tags, no class/function/imports. At build it is wrapped into a default-exported
 * template function whose Capitalized component tags (`<Box>`, `<Icons.Mail>`) are resolved from the
 * `@fromcode119/reactor` `Registry`. Native DOM tags pass through. The component wires it with
 * `protected readonly view = <import>` (or, with ViewPairPlugin, nothing at all).
 *
 * Tag detection is AST-based (@babel/parser): it walks JSX opening elements, so `<` in strings, comments,
 * or comparisons is never mistaken for a tag. View files are not type-checked (esbuild transform only).
 *
 *   esbuild.build({ plugins: [ViewPlugin.esbuild()] });                 // default suffix ".view"
 *   esbuild.build({ plugins: [ViewPlugin.esbuild({ suffix: 'template' })] }); // "*.template.tsx"
 */
export class ViewPlugin {
  /** Root identifiers of Capitalized JSX tags via AST: `<Box>`→`Box`, `<Icons.Mail>`→`Icons`. */
  static collectComponentTags(source: string): string[] {
    const roots = new Set<string>();
    let ast: unknown;
    try {
      ast = parse(source, { sourceType: 'module', errorRecovery: true, plugins: ['jsx', 'typescript'] });
    } catch {
      return [];
    }
    ViewPlugin.walk(ast, roots);
    return [...roots];
  }

  private static walk(node: unknown, roots: Set<string>): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) ViewPlugin.walk(child, roots);
      return;
    }
    const record = node as Record<string, unknown>;
    if (record['type'] === 'JSXOpeningElement') {
      const root = ViewPlugin.rootName(record['name']);
      if (root && /^[A-Z]/.test(root)) roots.add(root);
    }
    for (const key of Object.keys(record)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'range' || key === 'leadingComments') continue;
      ViewPlugin.walk(record[key], roots);
    }
  }

  private static rootName(name: unknown): string | null {
    const record = name as Record<string, unknown> | null;
    if (!record) return null;
    if (record['type'] === 'JSXIdentifier') return record['name'] as string;
    if (record['type'] === 'JSXMemberExpression') return ViewPlugin.rootName(record['object']);
    return null;
  }

  /** Wrap bare markup into a default-exported render that resolves its component tags from the Registry. */
  static wrap(source: string, registryModule = '@fromcode119/reactor'): string {
    const resolvers = ViewPlugin.collectComponentTags(source)
      .map((name) => `  const ${name} = Registry.get(${JSON.stringify(name)});`)
      .join('\n');
    return [
      `import { Registry } from ${JSON.stringify(registryModule)};`,
      'export default function () {',
      resolvers,
      '  return (',
      source,
      '  );',
      '}',
      '',
    ].join('\n');
  }

  static esbuild(options: { suffix?: string; registryModule?: string } = {}): PluginLike {
    const suffix = options.suffix ?? 'view';
    const registryModule = options.registryModule ?? '@fromcode119/reactor';
    const filter = new RegExp(`\\.${suffix}\\.(t|j)sx?$`);
    return {
      name: 'nextor-view-template',
      setup(build: BuildLike): void {
        build.onLoad({ filter }, async (args) => ({
          contents: ViewPlugin.wrap(await readFile(args.path, 'utf8'), registryModule),
          loader: args.path.endsWith('.tsx') || args.path.endsWith('.jsx') ? 'jsx' : 'js',
        }));
      },
    };
  }
}
