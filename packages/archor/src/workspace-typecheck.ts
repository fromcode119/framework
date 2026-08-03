import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { IWorkspaceAreaResult } from './interfaces/workspace-area-result.interface';

/**
 * Type-checks EVERY authored area of the workspace — plugins, themes, appearances.
 *
 * This belongs to typor because typor owns TypeScript itself: it already rewrites the extended syntax
 * (`typor-build`) and checks projects (`typor-typecheck`). Checking the extension areas is the same job.
 *
 * Why it must exist: a type rule is only enforced where a checker runs. esbuild and Vite strip types
 * without checking them, and `next build` sets `ignoreBuildErrors`. Plugin UI (`src/ui/**`), themes and
 * appearances were never checked by anything — so a class that fails to satisfy its `implements` clause
 * compiled and shipped. Framework packages are covered by their own `tsc` build.
 *
 * Ratcheted per area: the count may fall, never rise.
 */
export class WorkspaceTypecheck {
  /** Areas that have no tsconfig of their own, with the globs that constitute their authored source. */
  private static readonly AREAS: ReadonlyArray<{ name: string; dir: string; marker: string; include: string[] }> = [
    { name: 'plugins', dir: 'plugins', marker: 'index.ts', include: ['index.ts', 'src/**/*.ts', 'src/**/*.tsx'] },
    { name: 'themes', dir: 'themes', marker: 'src', include: ['src/**/*.ts', 'src/**/*.tsx'] },
    { name: 'appearance', dir: 'appearance', marker: 'index.ts', include: ['index.ts', '*.ts', '*.tsx'] },
  ];

  /**
   * Resolution + compiler settings that mirror the framework's own build, so counts mean something.
   * Public because every typor tool that builds a Program over workspace source must resolve modules the
   * SAME way — a tool with weaker `paths` silently fails to resolve `@fromcode119/*` and then reasons
   * from a type it could not see.
   */
  static compilerOptions(framework: string): Record<string, unknown> {
    const pkg = (p: string) => path.join(framework, 'packages', p);
    return {
      // ESNext, not CommonJS: plugin UI and theme seeds are BUNDLED as ES modules (esbuild/Vite), and a
      // seed that legitimately reads `import.meta.url` is only an error under CommonJS. Checking them as
      // something they are not produced a phantom error — fix the checker, never the count.
      target: 'ESNext', module: 'ESNext', moduleResolution: 'node',
      experimentalDecorators: true, useDefineForClassFields: false,
      esModuleInterop: true, skipLibCheck: true, strict: false,
      noImplicitAny: false, jsx: 'react-jsx', noEmit: true, baseUrl: '.',
      // themes import their i18n bundles directly (`@theme/i18n/bg.json`)
      resolveJsonModule: true,
      // `react` is not optional: `jsx: 'react-jsx'` alone does not bring in the global JSX namespace,
      // and without it every `JSX.Element` annotation in plugin UI reports TS2503.
      typeRoots: [path.join(framework, 'node_modules', '@types')], types: ['node', 'react'],
      paths: {
        '@fromcode119/sdk': [pkg('sdk/dist/index.d.ts')],
        '@fromcode119/sdk/*': [pkg('sdk/dist/*')],
        '@fromcode119/reactor': [pkg('reactor/dist/index.d.ts')],
        '@fromcode119/core': [pkg('core/dist/index.d.ts')],
        '@fromcode119/core/*': [pkg('core/dist/*')],
        '@fromcode119/database': [pkg('database/dist/index.d.ts')],
        '@fromcode119/database/*': [pkg('database/dist/*')],
        // `@fromcode119/sdk/admin` re-exports `@fromcode119/admin/components`, so the check walks into
        // admin's SOURCE — which uses admin's own `@/` alias. Without these two entries every one of those
        // imports is unresolvable and the plugin is blamed for the framework's paths.
        '@fromcode119/admin': [pkg('admin/lib/index.ts')],
        '@fromcode119/admin/*': [pkg('admin/*')],
        // ai's own PRIVATE alias — the check walks into ai's SOURCE, which uses it. Unmapped, every one
        // of those imports is unresolvable and gets blamed on whatever area pulled ai in.
        '@ai/*': [pkg('ai/src/*')],
        '@fromcode119/ai': [pkg('ai/src/index.ts')],
        '@fromcode119/ai/admin': [pkg('ai/src/admin-extension.ts')],
        '@fromcode119/ai/*': [pkg('ai/src/*')],
        '@/*': [pkg('admin/*')],
        '*': [path.join(framework, 'node_modules', '*'), path.join(framework, 'node_modules', '@types', '*')],
      },
    };
  }

  /** Run tsc over one directory through an ephemeral config, always removing it afterwards. */
  private static checkDir(framework: string, dir: string, include: string[]): string[] {
    const cfg = path.join(dir, 'tsconfig.__typor-check.json');
    // Style imports are resolved by the bundlers (Vite/esbuild), not by tsc. Without an ambient module
    // every `import './x.css'` in a plugin reads as a missing module and is blamed on the plugin.
    const ambient = path.join(dir, 'typor-ambient.__typor-check.d.ts');
    writeFileSync(ambient, [
      "declare module '*.css';",
      "declare module '*.less';",
      "declare module '*.scss';",
      '',
    ].join('\n'));
    // `@theme` is the alias the shared theme Vite config installs (ThemeViteConfig) — a theme's own source
    // resolves through it, so the checker must know it or every internal import reads as missing.
    const options = {
      ...WorkspaceTypecheck.compilerOptions(framework),
      paths: {
        '@theme/*': ['./src/*'],
        ...(WorkspaceTypecheck.compilerOptions(framework).paths as Record<string, string[]>),
      },
    };
    writeFileSync(cfg, JSON.stringify({
      compilerOptions: options,
      include: [...include, 'typor-ambient.__typor-check.d.ts'],
      exclude: ['node_modules', '**/*.test.ts', '**/*.test.tsx'],
    }, null, 2));
    try {
      execFileSync(path.join(framework, 'node_modules/.bin/tsc'), ['--noEmit', '-p', cfg], { encoding: 'utf8', cwd: dir });
      return [];
    } catch (err) {
      const out = (err as { stdout?: string }).stdout ?? '';
      return String(out).split('\n').filter((line) => / error TS\d+/.test(line));
    } finally {
      rmSync(cfg, { force: true });
      rmSync(ambient, { force: true });
    }
  }

  /** Check every area; returns one result per area with its per-slug breakdown. */
  static run(root: string, framework: string): IWorkspaceAreaResult[] {
    return WorkspaceTypecheck.AREAS.map(({ name, dir, marker, include }) => {
      const base = path.join(root, dir);
      const slugs = !existsSync(base) ? [] : readdirSync(base)
        .filter((s) => statSync(path.join(base, s)).isDirectory() && existsSync(path.join(base, s, marker)))
        .sort();
      const perSlug = slugs.map((slug) => {
        const messages = WorkspaceTypecheck.checkDir(framework, path.join(base, slug), include);
        return { slug, errors: messages.length, messages };
      });
      return { area: name, total: perSlug.reduce((n, s) => n + s.errors, 0), perSlug };
    });
  }
}
