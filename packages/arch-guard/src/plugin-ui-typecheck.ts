import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Real `tsc --noEmit` over every plugin's admin UI (`plugins/<slug>/src/ui/**`).
 *
 * Plugin UI is bundled by Vite/esbuild, which STRIP types without checking them, and a plugin carries
 * no tsconfig — so this surface was never type-checked at all. It shipped a dead call:
 * `build-source-form.tsx` invoked `this.onGitUrlChange` after that method was deleted, the Git URL
 * field silently refused input, and every build stayed green. This is the gate.
 *
 * One project per plugin, generated into a temp dir, extending the SDK's committed
 * `tsconfig.plugin-ui.json` — the shared contract. Only three things are per-plugin: the `@plugin/*`
 * alias, the files, and where the host-supplied peer packages live. Nothing is written into a plugin.
 *
 * "Host-supplied" is not a list kept here: it is read from the SDK's own `peerDependencies`, which is
 * the declaration that the admin host provides those packages at runtime (the same reason
 * `PluginUiViteConfig` marks them external). A plugin's OWN runtime deps resolve from its own
 * `node_modules`, exactly as they do in the bundle.
 */
export class PluginUiTypecheck {
  /** `src/ui` relative to a plugin root — the only UI layout in this repo. */
  private static readonly UI_DIR = path.join('src', 'ui');

  /** Never walk into an installed dependency tree; a plugin may carry its own under `src/ui`. */
  private static readonly SKIP = new Set(['node_modules', 'dist']);

  /** Plugin slugs that have an admin UI, alphabetical. */
  static plugins(repo: string): string[] {
    const root = path.join(repo, 'plugins');
    let entries: string[];
    try { entries = readdirSync(root); } catch { return []; }
    return entries
      .filter((slug) => existsSync(path.join(root, slug, PluginUiTypecheck.UI_DIR)))
      .sort();
  }

  /** The reported diagnostic lines for one plugin's UI. The COUNT is this list's length — one tsc run, never two. */
  static report(framework: string, repo: string, slug: string): string[] {
    const project = PluginUiTypecheck.writeProject(framework, repo, slug);
    try {
      execFileSync(path.join(framework, 'node_modules/.bin/tsc'), ['--noEmit', '-p', project],
        { encoding: 'utf8', cwd: framework });
      return [];
    } catch (err) {
      return PluginUiTypecheck.diagnostics(String((err as { stdout?: string }).stdout ?? ''));
    }
  }

  /** Error lines only — test files are not the plugin's shipped surface. */
  private static diagnostics(output: string): string[] {
    return output.split('\n')
      .filter((line) => / error TS\d+/.test(line))
      .filter((line) => !/\.test\.[cm]?tsx?/.test(line));
  }

  /**
   * Write the generated project for one plugin and return its path.
   *
   * Generated, not committed: the peer paths point at wherever this checkout's framework happens to
   * be, and a committed config naming that would bake one machine's layout into shared source.
   */
  private static writeProject(framework: string, repo: string, slug: string): string {
    const pluginDir = path.join(repo, 'plugins', slug);
    const uiDir = path.join(pluginDir, PluginUiTypecheck.UI_DIR);
    const dir = mkdtempSync(path.join(tmpdir(), `plugin-ui-types-${slug}-`));

    const config = {
      extends: path.join(framework, 'packages/sdk/tsconfig.plugin-ui.json'),
      compilerOptions: {
        // `@plugin/` is the plugin's own root — the same alias the backend esbuild build and
        // PluginUiViteConfig map, so a specifier means the same file in all three.
        baseUrl: pluginDir,
        paths: { '@plugin/*': ['./*'], ...PluginUiTypecheck.peerPaths(framework) },
        typeRoots: [path.join(framework, 'node_modules/@types')],
      },
      files: [PluginUiTypecheck.writeAmbient(dir), ...PluginUiTypecheck.sources(uiDir)],
    };

    const project = path.join(dir, 'tsconfig.json');
    writeFileSync(project, JSON.stringify(config, null, 2), 'utf8');
    return project;
  }

  /**
   * Write the ambient module shapes for the non-code assets a plugin's UI imports, and return the path.
   *
   * GENERATED into the temp project, never committed: it describes what the BUILD does, so it belongs
   * with the build's own contract rather than as a stray declaration file in the SDK's source.
   * `PluginUiCssAsTextPlugin` hands a `.css` import to the bundle as a STRING (the plugin then ships it
   * through `PluginDefaultStyle`), so the declared type says string — not a side-effect-only import.
   */
  private static writeAmbient(dir: string): string {
    const file = path.join(dir, 'plugin-ui-assets.d.ts');
    writeFileSync(file, "declare module '*.css' {\n  const css: string;\n  export default css;\n}\n", 'utf8');
    return file;
  }

  /**
   * `paths` entries for the packages the admin host supplies, resolved against the framework's own
   * `node_modules`. A plugin has none of these installed — at runtime the host's import map provides
   * them — so without this every `import … from 'react'` reads as a missing module.
   */
  private static peerPaths(framework: string): Record<string, string[]> {
    const manifest = path.join(framework, 'packages/sdk/package.json');
    const peers = Object.keys(JSON.parse(readFileSync(manifest, 'utf8'))?.peerDependencies ?? {});
    const modules = path.join(framework, 'node_modules');

    // The SDK itself is host-supplied too — the admin serves it through the runtime import map, and a
    // plugin that has not been `npm link`ed has no copy. Resolved LAST (a plugin's own installed SDK
    // wins), and only in this generated project: a COMMITTED alias for the SDK would bake one
    // machine's checkout layout into shared config, which is exactly what the SDK rule forbids.
    const names = [...peers, '@fromcode119/sdk'];

    const out: Record<string, string[]> = {};
    for (const name of names) {
      // A package's types live either in its own `types`/`typings` entry or in the `@types` twin.
      const typed = path.join(modules, '@types', name.replace('@', '').replace('/', '__'));
      const home = existsSync(typed) ? typed : path.join(modules, name);
      if (name === '@fromcode119/sdk') { Object.assign(out, PluginUiTypecheck.sdkPaths(framework)); continue; }
      if (!existsSync(home)) continue;
      out[name] = [home];
      out[`${name}/*`] = [path.join(home, '*')];
    }
    return out;
  }

  /**
   * `paths` for every SDK entry point, derived FROM the SDK's own `exports` map — `.` , `./react`,
   * `./admin` and the rest, each pointing at the `types` file that entry declares.
   *
   * Derived rather than listed: TypeScript's `paths` does not consult a package's `exports`, so a
   * hand-written map here would be a second spelling of the entry points and would go stale the day
   * one is added. The SDK's manifest stays the single source of truth.
   */
  private static sdkPaths(framework: string): Record<string, string[]> {
    const pkg = path.join(framework, 'packages/sdk');
    const exported = JSON.parse(readFileSync(path.join(pkg, 'package.json'), 'utf8'))?.exports ?? {};

    const out: Record<string, string[]> = {};
    for (const [entry, target] of Object.entries(exported)) {
      const types = (target as { types?: string })?.types;
      if (!types) continue;
      const specifier = entry === '.' ? '@fromcode119/sdk' : `@fromcode119/sdk/${entry.replace(/^\.\//, '')}`;
      out[specifier] = [path.resolve(pkg, types)];
    }
    return out;
  }

  /** Every `.ts`/`.tsx` under a plugin's UI dir, excluding its own installed dependencies. */
  private static sources(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const name of entries) {
      if (PluginUiTypecheck.SKIP.has(name)) continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) PluginUiTypecheck.sources(full, out);
      else if (/\.tsx?$/.test(full) && !full.endsWith('.d.ts')) out.push(full);
    }
    return out;
  }
}
