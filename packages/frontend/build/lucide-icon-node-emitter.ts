import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
// Relative on purpose (same as the sibling Vite config): this file runs under `tsx` outside every app
// alias, and the constants file carries no imports of its own.
import { RuntimeAssetConstants } from '../../core/src/constants/runtime-asset.constants';

/**
 * Emits the Lucide icon set as per-icon DATA modules — one tiny ES module per icon holding nothing but
 * that icon's `__iconNode` (`[tag, attrs][]`) — plus the generated list of icon names the browser-side
 * loader (`packages/react/src/icons/lucide-lazy-loader.ts`) enumerates.
 *
 * Why data, not components: the loader used to import lucide's `dynamicIconImports` table (1,914 lazy
 * thunks). Under Next that is 1,914 lazy chunks plus a 177 KB table chunk on every page; in the
 * storefront runtime bundle — a classic IIFE, where Rollup must inline every dynamic import — it was
 * ALL 1,914 icon implementations, +155 KB gzip, on every page. A data module imports nothing (no
 * `react`, no `createLucideIcon`), so it cannot drag in a second React, and the ONE bundled
 * `createLucideIcon` turns it into the component at load time. The name list stays in the bundle
 * (~8 KB gzip) because the import map must be able to enumerate every icon export up front.
 *
 * Output, per target `public/` directory: `<public>/fc-runtime/icons/<lucide-react version>/<kebab>.js`
 * = `export default <json>;`. The version segment is what makes the app's immutable cache rule for
 * `/fc-runtime/*` correct for icons — a lucide upgrade mints new URLs. Every previous version directory
 * is removed first, so only the installed set is ever served.
 *
 * The names file is written into source (`lucide-icon-names.generated.json`): it is bundled by Next and
 * Vite, so it must exist BEFORE those builds run, and a drift test pins it to the installed lucide
 * version so a stale copy fails loudly instead of quietly serving 404s for icons lucide added.
 */
export class LucideIconNodeEmitter {
  /** Table of `kebab -> () => import(icon module)` that lucide ships beside its icons. */
  private static readonly TABLE_MODULE = 'lucide-react/dist/esm/dynamicIconImports.js';

  private static get frontendDir(): string {
    return path.resolve(__dirname, '..');
  }

  /** The installed `lucide-react` version, read from the package the frontend resolves. */
  static get lucideVersion(): string {
    const require = createRequire(path.join(LucideIconNodeEmitter.frontendDir, 'package.json'));
    return String(require('lucide-react/package.json').version);
  }

  /** `<publicDir>/fc-runtime/icons` — the directory holding one sub-directory per lucide version. */
  static iconsDir(publicDir: string): string {
    return path.join(publicDir, RuntimeAssetConstants.SEGMENT, RuntimeAssetConstants.ICONS_SEGMENT);
  }

  /** `<publicDir>/fc-runtime/icons/<version>` for the installed lucide. */
  static versionDir(publicDir: string, version: string): string {
    return path.join(LucideIconNodeEmitter.iconsDir(publicDir), version);
  }

  /** The names file content: the installed version plus every kebab icon key, in lucide's own order. */
  static namesDocument(version: string, names: string[]): string {
    return `${JSON.stringify({ lucideReact: version, names }, null, 2)}\n`;
  }

  /** One data module: the icon node as JSON, nothing else. */
  static iconModule(iconNode: unknown): string {
    return `export default ${JSON.stringify(iconNode)};\n`;
  }

  /** Every `[kebab, iconNode]` pair, by importing each icon module lucide ships and reading its `__iconNode`. */
  static async collect(): Promise<Array<[string, unknown]>> {
    const table = (await import(LucideIconNodeEmitter.TABLE_MODULE)).default as Record<string, () => Promise<{ __iconNode?: unknown }>>;
    const out: Array<[string, unknown]> = [];
    for (const [kebab, load] of Object.entries(table)) {
      const mod = await load();
      if (!Array.isArray(mod.__iconNode)) throw new Error(`lucide icon "${kebab}" exports no __iconNode`);
      out.push([kebab, mod.__iconNode]);
    }
    return out;
  }

  /**
   * Write the names file and the per-icon modules into every target public directory.
   * Returns what was written so the caller can log it.
   */
  static async emit(namesFile: string, publicDirs: string[]): Promise<{ version: string; count: number; dirs: string[] }> {
    const version = LucideIconNodeEmitter.lucideVersion;
    const icons = await LucideIconNodeEmitter.collect();
    const dirs: string[] = [];
    for (const publicDir of publicDirs) {
      const iconsDir = LucideIconNodeEmitter.iconsDir(publicDir);
      if (existsSync(iconsDir)) rmSync(iconsDir, { recursive: true, force: true });
      const dir = LucideIconNodeEmitter.versionDir(publicDir, version);
      mkdirSync(dir, { recursive: true });
      for (const [kebab, node] of icons) {
        writeFileSync(path.join(dir, `${kebab}.js`), LucideIconNodeEmitter.iconModule(node), 'utf8');
      }
      dirs.push(dir);
    }
    mkdirSync(path.dirname(namesFile), { recursive: true });
    writeFileSync(namesFile, LucideIconNodeEmitter.namesDocument(version, icons.map(([kebab]) => kebab)), 'utf8');
    return { version, count: icons.length, dirs };
  }
}
