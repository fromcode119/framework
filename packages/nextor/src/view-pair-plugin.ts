import { readFile, access } from 'node:fs/promises';
import { basename } from 'node:path';

type LoadResult = { contents: string; loader: string } | undefined;
type BuildLike = {
  onLoad(options: { filter: RegExp }, callback: (args: { path: string }) => Promise<LoadResult>): void;
};
type PluginLike = { name: string; setup(build: BuildLike): void };

/**
 * Auto-pairing: a component file `card.tsx` with a sibling `card.view.tsx` gets its view wired at build
 * time — so the component needs NO `import` and NO `render()`/`view =` line. Relies on the one-class-per-file
 * rule: the single exported class in `card.tsx` gets `prototype.view` set to the compiled `card.view`.
 *
 *   // card.tsx — logic only; no import, no render, no view line
 *   export class Card extends Reactor { @prop declare title: string; }
 *   // card.view.tsx — bare markup (compiled by ViewPlugin)
 *   <Box>{this.title}</Box>
 *
 * Pair this AFTER ViewPlugin in the plugin list. Non-paired `.tsx` files pass through untouched.
 */
export class ViewPairPlugin {
  static readonly filenamePattern = /\.(t|j)sx?$/;

  /** The single exported class name (one class per file), or null. */
  static classNameOf(source: string): string | null {
    const match = source.match(/export\s+(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/);
    return match ? match[1] : null;
  }

  /** Import specifier for a sibling `<base>.<suffix>.*`, or null if none exists. */
  static async siblingViewImport(path: string, suffix: string): Promise<string | null> {
    const withoutExt = path.replace(/\.(t|j)sx?$/, '');
    for (const ext of ['tsx', 'jsx', 'ts', 'js']) {
      try {
        await access(`${withoutExt}.${suffix}.${ext}`);
        return `./${basename(withoutExt)}.${suffix}`;
      } catch {
        // not this extension — keep looking
      }
    }
    return null;
  }

  static pair(source: string, className: string, importPath: string): string {
    return [
      `import __reactorPairedView from ${JSON.stringify(importPath)};`,
      source,
      `;(${className}).prototype.view = __reactorPairedView;`,
    ].join('\n');
  }

  static esbuild(options: { suffix?: string } = {}): PluginLike {
    const suffix = options.suffix ?? 'view';
    const viewPattern = new RegExp(`\\.${suffix}\\.(t|j)sx?$`);
    return {
      name: 'nextor-view-pair',
      setup(build: BuildLike): void {
        build.onLoad({ filter: ViewPairPlugin.filenamePattern }, async (args) => {
          if (viewPattern.test(args.path)) return undefined;                      // .<suffix>.* → ViewPlugin
          const importPath = await ViewPairPlugin.siblingViewImport(args.path, suffix);
          if (!importPath) return undefined;                                      // no sibling → untouched
          const source = await readFile(args.path, 'utf8');
          const className = ViewPairPlugin.classNameOf(source);
          if (!className) return undefined;
          const loader = args.path.endsWith('.tsx') || args.path.endsWith('.jsx') ? 'tsx' : 'ts';
          return { contents: ViewPairPlugin.pair(source, className, importPath), loader };
        });
      },
    };
  }
}
