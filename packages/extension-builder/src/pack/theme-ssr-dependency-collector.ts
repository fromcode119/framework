import * as fs from 'fs';
import * as path from 'path';
import { BuildStepResult } from '@extension-builder/build-step-result';

/**
 * Copies into a theme package exactly the node_modules its SERVER bundle needs at runtime.
 *
 * A theme's `ui-ssr/entry.mjs` leaves its UI stack as bare imports ON PURPOSE, and the framework
 * never needs to know which stack that is — the theme declares its own. Bundling a styled-system
 * library inlines it through Rollup's CJS interop and its style props stop being processed, so the
 * server emits a literal token like `max-width:container.md` instead of real CSS and the first
 * paint is mis-styled. Left external the output is correct — but then Node has to
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

  /**
   * Where `name` resolves FROM `fromDir`, walking node_modules upward exactly as Node does.
   *
   * `fromDir` is the package that needs it, not the theme. That is the whole of Node's algorithm and
   * the half that was missing: resolution starts at the importer, so `cosmiconfig` asking for `yaml`
   * finds `cosmiconfig/node_modules/yaml` before anything at the top level. npm nests a package
   * precisely when two dependents need different versions of it, so the nested copy is the normal
   * case, not a broken install — and searching only from the theme root reported a correctly
   * installed `yaml` as missing and failed the build with "run npm install", which changes nothing.
   */
  private static locate(fromDir: string, name: string): string {
    let dir = fromDir;
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
    // Each entry carries WHERE it is needed from, because that is where Node would start looking.
    // The roots are needed by the bundle itself, so they start at the theme.
    const queue: Array<{ name: string; from: string }> = [...roots].map((name) => ({ name, from: themeDir }));
    const missing: string[] = [];
    while (queue.length) {
      const { name, from } = queue.shift()!;
      if (resolved.has(name)) continue;
      const location = ThemeSsrDependencyCollector.locate(from, name);
      if (!location) {
        missing.push(name);
        continue;
      }
      resolved.set(name, location);
      const manifest = JSON.parse(fs.readFileSync(path.join(location, 'package.json'), 'utf8'));
      // PEER dependencies count. A UI library may declare a companion as a peer and still import it
      // at runtime, so a closure built from `dependencies` alone loads and then throws "Cannot find
      // package" — which disables server rendering entirely. Optional peers are skipped: they are
      // optional precisely because the package works without them.
      const optionalPeers = manifest.peerDependenciesMeta || {};
      const required = [
        ...Object.keys(manifest.dependencies || {}),
        ...Object.keys(manifest.peerDependencies || {}).filter((peer: string) => !optionalPeers[peer]?.optional),
      ];
      for (const dependency of required) {
        if (ThemeSsrDependencyCollector.HOST_PROVIDED.test(dependency)) continue;
        if (!resolved.has(dependency)) queue.push({ name: dependency, from: location });
      }
    }
    return { resolved, missing };
  }

  /**
   * Whether npm nested this package inside another one, rather than hoisting it to the top.
   *
   * Top level means exactly `<theme>/node_modules/<name>` — which is also the right test for a
   * scoped package, whose parent directory is the scope rather than `node_modules`. Anything else
   * UNDER the theme's node_modules was nested by npm. Anything outside the theme altogether was
   * hoisted by a workspace above it and still has to be copied in by name.
   */
  private static isNested(themeDir: string, name: string, location: string): boolean {
    const root = path.join(themeDir, 'node_modules');
    if (location === path.join(root, name)) return false;
    return location.startsWith(root + path.sep);
  }

  static collect(themeDir: string, packDir: string): BuildStepResult {
    const roots = ThemeSsrDependencyCollector.rootsFrom(path.join(themeDir, 'ui-ssr'));
    if (roots.size === 0) {
      return BuildStepResult.skipped(ThemeSsrDependencyCollector.STEP, 'the server bundle has no bare imports');
    }

    const { resolved, missing } = ThemeSsrDependencyCollector.closure(themeDir, roots);
    for (const [name, location] of resolved) {
      // A package npm NESTED is already carried by its parent: the parent is in this same closure
      // (it is what led here) and is copied whole, nested node_modules included. Copying it again to
      // the top level would flatten it — putting one version where two were installed, which is the
      // exact situation the nesting exists to prevent.
      if (ThemeSsrDependencyCollector.isNested(themeDir, name, location)) continue;

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
