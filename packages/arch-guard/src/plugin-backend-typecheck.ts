import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PluginUiTypecheck } from './plugin-ui-typecheck';

/**
 * Real `tsc --noEmit` over every plugin's BACKEND: its `index.ts` and everything under `src/` except
 * the admin UI (`src/ui/**`, which `PluginUiTypecheck` owns) and tests.
 *
 * A plugin's backend is bundled by esbuild, which strips types without checking them, and a plugin
 * carries no tsconfig — so a backend could call a context method that does not exist, or hand an
 * importer a field it never reads, and every build stayed green. Until the SDK shipped complete
 * declarations this could not be checked at all: half its forwarded modules had no `.d.ts`.
 *
 * One project per plugin, generated into a temp dir, never written into the plugin. It resolves
 * exactly what the runtime does: `@fromcode119/*` from the host (the SDK's own declarations), every
 * other package from the plugin's OWN `node_modules` — nothing from the framework's. A backend that
 * imports a package it does not declare resolved at runtime only by accident (finance's PDFs once did
 * through the framework's `pdfkit`), and here it is an error, which is the point. Node's own modules
 * are typed from the framework's `@types/node`, as the host is Node.
 */
export class PluginBackendTypecheck {
  private static readonly SKIP = new Set(['node_modules', 'dist', 'tests', 'ui']);

  /** The plugins under `root` with a backend entry, alphabetical by name. */
  static pluginDirs(root: string | null): string[] {
    if (!root) return [];
    let entries: string[];
    try { entries = readdirSync(root); } catch { return []; }
    return entries.sort().map((slug) => path.join(root, slug)).filter((dir) => PluginBackendTypecheck.hasBackend(dir));
  }

  static hasBackend(pluginDir: string): boolean {
    return existsSync(path.join(pluginDir, 'index.ts'));
  }

  /** The reported diagnostic lines for one plugin's backend. */
  static report(framework: string, pluginDir: string): string[] {
    const project = PluginBackendTypecheck.writeProject(framework, pluginDir);
    try {
      execFileSync(path.join(framework, 'node_modules/.bin/tsc'), ['--noEmit', '-p', project], { encoding: 'utf8', cwd: framework, maxBuffer: 64 * 1024 * 1024 });
      return [];
    } catch (err) {
      return String((err as { stdout?: string }).stdout ?? '').split('\n').filter((line) => / error TS\d+/.test(line));
    }
  }

  /**
   * Compiler options MIRROR the backend build (`BuildToolchain`'s esbuild options): legacy decorators
   * with no defined class fields. Not `strict`, as with the UI gate: this exists to catch a call to
   * something that does not exist, a renamed member, a wrong argument — not to impose a style. But
   * `strictNullChecks` IS on: backends narrow their result unions (`if (!result.ok) return result.error`)
   * and without it TypeScript does not narrow a boolean discriminant, so every such check would be
   * reported as an error the code does not have.
   */
  private static writeProject(framework: string, pluginDir: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), `plugin-backend-types-${path.basename(pluginDir)}-`));
    const config = {
      compilerOptions: {
        noEmit: true,
        target: 'ES2022',
        lib: ['ES2022'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        forceConsistentCasingInFileNames: true,
        experimentalDecorators: true,
        useDefineForClassFields: false,
        skipLibCheck: true,
        strict: false,
        noImplicitAny: false,
        strictNullChecks: true,
        baseUrl: pluginDir,
        paths: { '@plugin/*': ['./*'], ...PluginUiTypecheck.sdkPaths(framework) },
        typeRoots: [path.join(framework, 'node_modules/@types')],
        types: ['node'],
      },
      files: PluginBackendTypecheck.sources(pluginDir),
    };
    const project = path.join(dir, 'tsconfig.json');
    writeFileSync(project, JSON.stringify(config, null, 2), 'utf8');
    return project;
  }

  /** `index.ts` and every `.ts` under `src/`, minus the admin UI, tests and installed dependencies. */
  private static sources(pluginDir: string): string[] {
    const out = [path.join(pluginDir, 'index.ts')];
    const walk = (dir: string, top: boolean): void => {
      let entries: string[];
      try { entries = readdirSync(dir); } catch { return; }
      for (const name of entries) {
        if (PluginBackendTypecheck.SKIP.has(name) && (name !== 'ui' || top)) continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full, false);
        else if (/\.ts$/.test(name) && !/\.d\.ts$|\.test\.ts$/.test(name)) out.push(full);
      }
    };
    walk(path.join(pluginDir, 'src'), true);
    return out;
  }
}
