import type { Plugin } from 'vite';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { FromcodeThemeOverridesOptions } from './fromcode-theme-overrides-plugin.interfaces';

const VIRTUAL_MODULE_ID = 'virtual:fromcode/theme-overrides';
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_MODULE_ID;
const MANIFEST_FILE = 'overrides.json';

type DiscoveredSlot = { slotKey: string; absolutePath: string };
type OverrideManifest = Record<string, string>;

/**
 * Discovers active-theme renderer overrides without reading outside the theme.
 *
 * Supported roots:
 * - `src/overrides/frontend/**`
 * - `src/overrides/plugins/{namespace}/{owner}/**`
 *
 * By default the slot key is the relative file path with `/` replaced by `.`.
 * Optional `overrides.json` manifests can be added for exceptional mappings.
 */
export class FromcodeThemeOverridesPlugin {
  static create(options: FromcodeThemeOverridesOptions): Plugin {
    const { themeSlug, priority = 11, entry = 'index.jsx' } = options;

    let resolvedSrcDir: string;
    let resolvedCoreDir: string;
    let resolvedPluginsDir: string;
    let resolvedEntryId: string | null = null;
    let discoveredSlots: DiscoveredSlot[] = [];

    const rescan = (): DiscoveredSlot[] =>
      FromcodeThemeOverridesPlugin.sortSlots([
        ...FromcodeThemeOverridesPlugin.scanManifestOrLiteralRoot(resolvedCoreDir),
        ...FromcodeThemeOverridesPlugin.scanPluginsDir(resolvedPluginsDir),
      ]);

    return {
      name: 'fromcode-theme-overrides',
      enforce: 'pre',

      configResolved(config) {
        resolvedSrcDir = options.srcDir ?? join(config.root, 'src');
        resolvedCoreDir = join(resolvedSrcDir, 'overrides', 'frontend');
        resolvedPluginsDir = join(resolvedSrcDir, 'overrides', 'plugins');
        resolvedEntryId = join(resolvedSrcDir, entry);
      },

      buildStart() {
        discoveredSlots = rescan();
      },

      handleHotUpdate({ file, server }) {
        if (file.startsWith(resolvedCoreDir) || file.startsWith(resolvedPluginsDir)) {
          discoveredSlots = rescan();
          const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
      },

      resolveId(id) {
        if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_ID;
      },

      load(id) {
        if (id !== RESOLVED_VIRTUAL_ID) return;
        if (discoveredSlots.length === 0) {
          return `// fromcode-theme-overrides: no override files found in ${resolvedSrcDir}/overrides\n`;
        }
        return FromcodeThemeOverridesPlugin.generateVirtualModule(discoveredSlots, themeSlug, priority);
      },

      transform(code, id) {
        if (resolvedEntryId && id === resolvedEntryId) {
          return `import '${VIRTUAL_MODULE_ID}';\n` + code;
        }
      },
    };
  }

  private static scanPluginsDir(pluginsDir: string): DiscoveredSlot[] {
    const namespaces = FromcodeThemeOverridesPlugin.readDirs(pluginsDir);
    const results: DiscoveredSlot[] = [];

    for (const namespace of namespaces) {
      const namespaceDir = join(pluginsDir, namespace);
      for (const owner of FromcodeThemeOverridesPlugin.readDirs(namespaceDir)) {
        const ownerDir = join(namespaceDir, owner);
        results.push(...FromcodeThemeOverridesPlugin.scanManifestOrLiteralRoot(ownerDir));
      }
    }

    return results;
  }

  private static scanManifestOrLiteralRoot(rootDir: string): DiscoveredSlot[] {
    const manifestPath = join(rootDir, MANIFEST_FILE);
    if (existsSync(manifestPath)) return FromcodeThemeOverridesPlugin.scanManifestRoot(rootDir);
    return FromcodeThemeOverridesPlugin.scanLiteralSlotDir(rootDir);
  }

  private static scanManifestRoot(rootDir: string): DiscoveredSlot[] {
    const manifestPath = join(rootDir, MANIFEST_FILE);
    if (!existsSync(manifestPath)) return [];

    const manifest = FromcodeThemeOverridesPlugin.readManifest(manifestPath);
    const mappedFiles = new Set(Object.keys(manifest));
    const overrideFiles = FromcodeThemeOverridesPlugin.scanOverrideFiles(rootDir, (rel) => !rel.startsWith(`slots${sep}`));
    const results: DiscoveredSlot[] = [];

    for (const overrideFile of overrideFiles) {
      const rel = FromcodeThemeOverridesPlugin.normalizePath(relative(rootDir, overrideFile));
      const slotKey = manifest[rel];
      if (!slotKey) {
        throw new Error(`Theme override ${overrideFile} is not listed in ${manifestPath}.`);
      }
      mappedFiles.delete(rel);
      results.push({ slotKey, absolutePath: overrideFile });
    }

    if (mappedFiles.size > 0) {
      throw new Error(`${manifestPath} references missing override files: ${[...mappedFiles].join(', ')}`);
    }

    return results;
  }

  private static readManifest(manifestPath: string): OverrideManifest {
    const raw = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`${manifestPath} must contain a JSON object.`);
    }

    const manifest: OverrideManifest = {};
    for (const [relPath, slotKey] of Object.entries(raw)) {
      if (typeof slotKey !== 'string' || !slotKey.trim()) {
        throw new Error(`${manifestPath} has an invalid slot key for ${relPath}.`);
      }
      manifest[FromcodeThemeOverridesPlugin.normalizePath(relPath)] = slotKey;
    }
    return manifest;
  }

  private static scanLiteralSlotDir(rootDir: string): DiscoveredSlot[] {
    return FromcodeThemeOverridesPlugin.scanOverrideFiles(rootDir).map((absolutePath) => {
      const rel = FromcodeThemeOverridesPlugin.normalizePath(relative(rootDir, absolutePath));
      return {
        slotKey: rel.replace(/\.tsx$/, '').split('/').join('.'),
        absolutePath,
      };
    });
  }

  private static scanOverrideFiles(rootDir: string, include: (rel: string) => boolean = () => true): string[] {
    const results: string[] = [];

    function walk(dir: string): void {
      let entries: string[];
      try {
        entries = readdirSync(dir).sort((a, b) => a.localeCompare(b));
      } catch {
        return;
      }

      for (const name of entries) {
        if (name.startsWith('_')) continue;
        const fullPath = join(dir, name);
        if (statSync(fullPath).isDirectory()) {
          walk(fullPath);
        } else if (FromcodeThemeOverridesPlugin.isOverrideComponentFile(name)) {
          const rel = FromcodeThemeOverridesPlugin.normalizePath(relative(rootDir, fullPath));
          if (include(rel)) results.push(fullPath);
        }
      }
    }

    walk(rootDir);
    return results;
  }

  private static readDirs(dir: string): string[] {
    try {
      return readdirSync(dir)
        .filter((name) => {
          if (name.startsWith('_')) return false;
          try {
            return statSync(join(dir, name)).isDirectory();
          } catch {
            return false;
          }
        })
        .sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  }

  private static isOverrideComponentFile(name: string): boolean {
    return name.endsWith('.tsx') && !name.endsWith('.interfaces.tsx') && !name.endsWith('.types.tsx');
  }

  private static normalizePath(path: string): string {
    return path.split(sep).join('/');
  }

  private static sortSlots(slots: DiscoveredSlot[]): DiscoveredSlot[] {
    return [...slots].sort((a, b) => {
      const slotComparison = a.slotKey.localeCompare(b.slotKey);
      if (slotComparison !== 0) return slotComparison;
      return a.absolutePath.localeCompare(b.absolutePath);
    });
  }

  private static generateVirtualModule(slots: DiscoveredSlot[], themeSlug: string, priority: number): string {
    const importLines = slots.map(({ absolutePath }, i) => {
      const importPath = FromcodeThemeOverridesPlugin.normalizePath(absolutePath);
      return `const _slot${i} = () => import('${importPath}');`;
    });
    const mapEntries = slots.map(({ slotKey }, i) => `  '${slotKey}': _slot${i},`);

    return [
      `import { ThemeOverrideRegistrar } from '@fromcode119/sdk/react';`,
      ``,
      ...importLines,
      ``,
      `const _slots = {`,
      ...mapEntries,
      `};`,
      ``,
      `ThemeOverrideRegistrar.register(_slots, '${themeSlug}', ${priority});`,
    ].join('\n');
  }
}
