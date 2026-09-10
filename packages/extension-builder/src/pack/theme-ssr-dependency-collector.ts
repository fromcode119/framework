import * as fs from 'fs';
import * as path from 'path';
import { BuildStepResult } from '@extension-builder/build-step-result';

/**
 * Copies into a theme package exactly the node_modules its SERVER bundle needs at runtime.
 *
 * A theme's `ui-ssr/entry.mjs` leaves its UI stack (Chakra, emotion, framer-motion) as bare imports
 * on purpose: bundling Chakra inlines its styled-system through Rollup's CJS interop and its style
 * props stop being processed, so the server emits literal `max-width:container.md` instead of real
 * CSS and the first paint is mis-styled. Left external the output is correct — but then Node has to
 * resolve those packages at runtime, and an installed theme ships no `node_modules` at all. That is
 * why production once served content-free pages: the server bundle could not be imported.
 *
 * So the package carries its own runtime deps. WHICH ones is not guessed — it is read from the
 * built bundle's own bare imports, minus what the host process provides.
 */
export class ThemeSsrDependencyCollector {
  static readonly STEP = 'theme-ssr-dependency-collector';

  /** Provided by the frontend process itself — never shipped inside a theme. */
  private static readonly HOST_PROVIDED = /^(react|react-dom|scheduler|@fromcode119)($|\/)/;

  private static readonly IMPORT = /^(?:import|export)\s[^;]*?from\s*["']([^"']+)["']|^import\s*["']([^"']+)["']/gm;

  /** Package names the built bundle expects Node to resolve. */
  private static rootsFrom(ssrDir: string): Set<string> {
    const roots = new Set<string>();
    if (!fs.existsSync(ssrDir)) return roots;
    for (const file of fs.readdirSync(ssrDir).filter((name) => name.endsWith('.mjs'))) {
      const source = fs.readFileSync(path.join(ssrDir, file), 'utf8');
      for (const match of source.matchAll(ThemeSsrDependencyCollector.IMPORT)) {
        const specifier = match[1] || match[2];
        if (!specifier || specifier.startsWith('.') || specifier.startsWith('node:')) continue;
        if (ThemeSsrDependencyCollector.HOST_PROVIDED.test(specifier)) continue;
        const parts = specifier.split('/');
        roots.add(specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!);
      }
    }
    return roots;
  }

  /** Where `name` resolves from `themeDir`, walking node_modules upward as Node would. */
  private static locate(themeDir: string, name: string): string {
    let dir = themeDir;
    while (dir !== path.dirname(dir)) {
      const candidate = path.join(dir, 'node_modules', name);
      if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
      dir = path.dirname(dir);
    }
    return '';
  }

  /** Every package the roots need, transitively. Absent optional deps are simply skipped. */
  private static closure(themeDir: string, roots: Set<string>): { resolved: Map<string, string>; missing: string[] } {
    const resolved = new Map<string, string>();
    const queue = [...roots];
    const missing: string[] = [];
    while (queue.length) {
      const name = queue.shift()!;
      if (resolved.has(name)) continue;
      const location = ThemeSsrDependencyCollector.locate(themeDir, name);
      if (!location) {
        missing.push(name);
        continue;
      }
      resolved.set(name, location);
      const manifest = JSON.parse(fs.readFileSync(path.join(location, 'package.json'), 'utf8'));
      // PEER dependencies count. Chakra declares framer-motion as a peer and imports it at runtime,
      // so a closure built from `dependencies` alone loads and then throws "Cannot find package
      // 'framer-motion'" — which disables server rendering entirely. Optional peers are skipped:
      // they are optional precisely because the package works without them.
      const optionalPeers = manifest.peerDependenciesMeta || {};
      const required = [
        ...Object.keys(manifest.dependencies || {}),
        ...Object.keys(manifest.peerDependencies || {}).filter((peer: string) => !optionalPeers[peer]?.optional),
      ];
      for (const dependency of required) {
        if (ThemeSsrDependencyCollector.HOST_PROVIDED.test(dependency)) continue;
        if (!resolved.has(dependency)) queue.push(dependency);
      }
    }
    return { resolved, missing };
  }

  static collect(themeDir: string, packDir: string): BuildStepResult {
    const roots = ThemeSsrDependencyCollector.rootsFrom(path.join(themeDir, 'ui-ssr'));
    if (roots.size === 0) {
      return BuildStepResult.skipped(ThemeSsrDependencyCollector.STEP, 'the server bundle has no bare imports');
    }

    const { resolved, missing } = ThemeSsrDependencyCollector.closure(themeDir, roots);
    for (const [name, location] of resolved) {
      const target = path.join(packDir, 'node_modules', name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(location, target, { recursive: true, dereference: true });
    }

    // Never silent. A missing package means the server bundle will not import on the installed
    // site, and the only symptom there is pages with no content.
    if (missing.length) {
      return BuildStepResult.failure(
        ThemeSsrDependencyCollector.STEP,
        `not found in the theme's node_modules: ${missing.join(', ')}. Run npm install in the theme before packing, or the installed theme will not server-render.`,
      );
    }
    return BuildStepResult.ok(`${ThemeSsrDependencyCollector.STEP} (${resolved.size} packages)`);
  }
}
