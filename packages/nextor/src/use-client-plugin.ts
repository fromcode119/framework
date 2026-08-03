import { readFile } from 'node:fs/promises';

/** The subset of the esbuild plugin API this uses — typed structurally so esbuild isn't a hard dep. */
type BuildLike = {
  onLoad(options: { filter: RegExp }, callback: (args: { path: string }) => Promise<{ contents: string; loader: string }>): void;
};
type PluginLike = { name: string; setup(build: BuildLike): void };

/**
 * `.client.*` filename → `'use client'`. A file named `foo.client.tsx` is treated as a Next.js client
 * component: the directive is injected at build time, so the literal never appears in source.
 *
 * `'use client'` is a Next compile directive (the bundler scans for the literal string) — it can't be an
 * import, class, or decorator, so a build step reading it off the filename is the only clean way. Lives in
 * `nextor` (the Next/build layer), never in `reactor` (which stays pure React) and never as a loose script.
 *
 *   // build config
 *   esbuild.build({ plugins: [UseClientPlugin.esbuild()] });
 */
export class UseClientPlugin {
  static readonly filenamePattern = /\.client\.(t|j)sx?$/;

  static loaderFor(path: string): string {
    if (path.endsWith('.tsx')) return 'tsx';
    if (path.endsWith('.jsx')) return 'jsx';
    if (path.endsWith('.ts')) return 'ts';
    return 'js';
  }

  /** Prepend the directive unless the source already begins with it (idempotent). */
  static injectInto(source: string): string {
    const head = source.replace(/^﻿?\s*/, '');
    if (head.startsWith("'use client'") || head.startsWith('"use client"')) return source;
    return `'use client';\n${source}`;
  }

  /** The esbuild plugin object (`setup(build)` shape is esbuild's contract). */
  static esbuild(): PluginLike {
    return {
      name: 'nextor-use-client-from-filename',
      setup(build: BuildLike): void {
        build.onLoad({ filter: UseClientPlugin.filenamePattern }, async (args) => ({
          contents: UseClientPlugin.injectInto(await readFile(args.path, 'utf8')),
          loader: UseClientPlugin.loaderFor(args.path),
        }));
      },
    };
  }
}
