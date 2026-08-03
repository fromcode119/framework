import { readFile } from 'node:fs/promises';
import { TyporSyntaxPlugin } from './typor-syntax-plugin';

import type { IBuildLike } from './interfaces/build-like.interface';
import type { IPluginLike } from './interfaces/plugin-like.interface';

/**
 * esbuild plugin for typor's extended syntax — the plugin/theme/appearance builds go through esbuild,
 * so they need the same an `extends` clause naming two bases rewrite the Next loader performs.
 */
export class TyporEsbuildPlugin {
  static loaderFor(path: string): string {
    if (path.endsWith('.tsx')) return 'tsx';
    if (path.endsWith('.jsx')) return 'jsx';
    if (path.endsWith('.ts')) return 'ts';
    return 'js';
  }

  static esbuild(): IPluginLike {
    return {
      name: 'typor-multiple-inheritance',
      setup(build: IBuildLike): void {
        build.onLoad({ filter: /\.(t|j)sx?$/ }, async (args) => {
          const source = await readFile(args.path, 'utf8');
          if (!TyporSyntaxPlugin.handles(source)) return undefined;
          return { contents: TyporSyntaxPlugin.transform(source), loader: TyporEsbuildPlugin.loaderFor(args.path) };
        });
      },
    };
  }
}
