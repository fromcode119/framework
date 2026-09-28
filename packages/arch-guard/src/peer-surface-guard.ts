/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { ExtensionTrees } from './cli/extension-trees';

/**
 * A method a plugin means to expose to its peers, missing from the map that actually exposes it.
 *
 * `publicAPI` comes in two shapes. Assigning the CLASS (`publicAPI = FinancePublicAPI`) exposes every
 * static on it — the framework enumerates them at guest boot, and nothing can drift. Assigning an
 * OBJECT (`publicAPI = { listPages: CmsPublicApi.listPages, … }`) hand-lists them, and that list is a
 * second place to remember.
 *
 * Forgetting it compiles, packs and boots perfectly, then fails at the call site with
 * `"<method>" is not callable` — which is how `registerFulfillmentProviderSource` failed the first
 * time it was added. Nothing typed the gap, because both sides are valid on their own.
 *
 * Only the object shape is checked; the class shape has nothing to check.
 */
export class PeerSurfaceGuard {
  /**
   * Plumbing a plugin calls on ITSELF during boot, never across the boundary.
   *
   * `setRuntimeContext` is handed the plugin's own context by its own `on-init`. Exposing it to peers
   * would be worse than omitting it: any plugin could then swap another's runtime context. Anything
   * added here needs its own reason written beside it.
   */
  private static readonly NOT_PEER_CALLABLE = new Set(['setRuntimeContext']);

  static run(): number {
    const pluginsDir = ExtensionTrees.dir('plugins');
    if (!pluginsDir) return 0;
    const findings: string[] = [];
    let checked = 0;

    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(pluginsDir, { withFileTypes: true }); } catch {
      console.log(`No plugins directory at ${pluginsDir}; nothing to scan.`);
      return 0;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const indexPath = path.join(pluginsDir, entry.name, 'index.ts');
      if (!fs.existsSync(indexPath)) continue;
      const index = fs.readFileSync(indexPath, 'utf8');

      const map = PeerSurfaceGuard.objectMap(index);
      // The class shape exposes everything; there is no second list to fall out of step with.
      if (!map) continue;
      checked++;

      // EVERY class the map draws on. Only the last one used to be checked, so a map listing two classes
      // (ecommerce: its public API and its fulfilment API) never looked at the first — and a method added
      // to it but not to the map shipped, and failed as "is not callable" when finance called it.
      for (const [className, exposed] of map) {
        const source = PeerSurfaceGuard.classSource(path.join(pluginsDir, entry.name), className);
        if (!source) continue;
        for (const method of PeerSurfaceGuard.statics(source)) {
          if (exposed.has(method) || PeerSurfaceGuard.NOT_PEER_CALLABLE.has(method)) continue;
          findings.push(`plugins/${entry.name}: ${className}.${method} is not in the publicAPI map in index.ts`);
        }
      }
    }

    if (findings.length) {
      console.error(`[check-peer-surface] ${findings.length} method(s) a peer could not call:\n`);
      for (const finding of findings) console.error(`  ${finding}`);
      console.error(
        '\nA hand-listed `publicAPI` map is a second place to remember. A method missing from it' +
        '\ncompiles, packs and boots, then fails at the call site with "<method>" is not callable.' +
        '\n\n  meant for peers      -> add it to the map in index.ts' +
        '\n  internal to the plugin -> make it `private static`, so nothing has to remember' +
        '\n  expose everything     -> assign the CLASS instead of an object literal',
      );
      return 1;
    }

    console.log(`Checked ${checked} plugin(s) with a hand-listed publicAPI map.`);
    console.log('OK — every peer-callable static is exposed.');
    return 0;
  }

  /**
   * The `publicAPI = { key: Class.method }` shape, as class -> the method names the map takes from it;
   * null for the class shape / no publicAPI. A map may draw on several classes.
   */
  private static objectMap(index: string): Map<string, Set<string>> | null {
    if (!/publicAPI\s*=\s*\{/.test(index)) return null;
    const classes = new Map<string, Set<string>>();
    for (const match of index.matchAll(/([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_]+PublicApi|[A-Za-z0-9_]+PublicAPI)\s*\.([A-Za-z0-9_]+)/g)) {
      const exposed = classes.get(match[2]!) ?? new Set<string>();
      exposed.add(match[3]!);
      classes.set(match[2]!, exposed);
    }
    return classes.size ? classes : null;
  }

  private static classSource(pluginDir: string, className: string): string | null {
    for (const file of PeerSurfaceGuard.walk(path.join(pluginDir, 'src'))) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const source = fs.readFileSync(file, 'utf8');
      if (new RegExp(`class\\s+${className}\\b`).test(source)) return source;
    }
    return null;
  }

  /** PUBLIC statics only: `private static` is already unreachable from a peer and needs no listing. */
  private static statics(source: string): string[] {
    const names: string[] = [];
    for (const match of source.matchAll(/^\s{2}(private\s+|protected\s+)?static\s+(readonly\s+)?(async\s+)?([a-zA-Z0-9_]+)\s*[(<]/gm)) {
      if (match[1]) continue;
      names.push(match[4]!);
    }
    return [...new Set(names)];
  }

  private static *walk(dir: string): Generator<string> {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
        yield* PeerSurfaceGuard.walk(full);
      } else if (entry.isFile()) {
        yield full;
      }
    }
  }
}
