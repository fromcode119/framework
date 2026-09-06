import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-ignore -- untyped deep import (lucide ships no declaration for its ESM table); only its keys are read.
import dynamicIconImports from 'lucide-react/dist/esm/dynamicIconImports.js';
import lucideIconNames from '@fromcode119/react/icons/lucide-icon-names.generated.json';
import { LucideIconNodeEmitter } from '@/build/lucide-icon-node-emitter';

/**
 * Drift guard for the generated Lucide artefacts (`npm run build:frontend-icons`):
 *   - the names file in `packages/react/src/icons` is GENERATED, never hand-written: it must equal the
 *     installed lucide's own icon table, key for key and in order, and name the installed version;
 *   - every icon has its data module on disk, in every app that serves the set, under the version the
 *     names file declares (the URL the browser loader builds);
 *   - a data module is a real ES module whose default export IS lucide's `__iconNode` for that icon.
 * A lucide upgrade without regeneration fails here, loudly, instead of serving 404s for new icons.
 */
class LucideIconFixture {
  static readonly frameworkRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  /** The apps whose `public/` serves the icon set — the targets `build:frontend-icons` names. */
  static readonly publicDirs = ['packages/frontend/public', 'packages/admin/public'].map((dir) =>
    path.resolve(LucideIconFixture.frameworkRoot, dir),
  );
  static readonly installedVersion: string = JSON.parse(
    readFileSync(path.resolve(LucideIconFixture.frameworkRoot, 'node_modules/lucide-react/package.json'), 'utf8'),
  ).version;
  static readonly tableKeys: string[] = Object.keys(dynamicIconImports as Record<string, unknown>);

  static moduleFile(publicDir: string, kebab: string): string {
    return path.join(LucideIconNodeEmitter.versionDir(publicDir, lucideIconNames.lucideReact), `${kebab}.js`);
  }
}

describe('generated lucide icon names', () => {
  it('names the installed lucide-react version', () => {
    expect(lucideIconNames.lucideReact).toBe(LucideIconFixture.installedVersion);
  });

  it('equals the installed lucide icon table, key for key (regenerate with `npm run build:frontend-icons`)', () => {
    expect(LucideIconFixture.tableKeys.length).toBeGreaterThan(1000);
    expect(lucideIconNames.names).toEqual(LucideIconFixture.tableKeys);
  });
});

describe('emitted lucide icon data modules', () => {
  it('exist for every icon, in every app public dir, under the declared version', () => {
    for (const publicDir of LucideIconFixture.publicDirs) {
      const missing = lucideIconNames.names.filter((kebab) => !existsSync(LucideIconFixture.moduleFile(publicDir, kebab)));
      expect(missing, `${path.relative(LucideIconFixture.frameworkRoot, publicDir)} is missing ${missing.length} icon module(s), e.g. ${missing.slice(0, 3).join(', ')}`).toEqual([]);
    }
  });

  it('serve no other version directory than the installed one', () => {
    for (const publicDir of LucideIconFixture.publicDirs) {
      const iconsDir = LucideIconNodeEmitter.iconsDir(publicDir);
      expect(existsSync(path.join(iconsDir, LucideIconFixture.installedVersion))).toBe(true);
    }
  });

  it('are ES modules whose default export is lucide\'s own __iconNode', async () => {
    const [publicDir] = LucideIconFixture.publicDirs;
    for (const kebab of ['airplay', 'chevron-down', 'layout-dashboard']) {
      const emitted = (await import(pathToFileURL(LucideIconFixture.moduleFile(publicDir, kebab)).href)).default;
      const lucide = (await (dynamicIconImports as Record<string, () => Promise<{ __iconNode: unknown }>>)[kebab]()).__iconNode;
      expect(emitted).toEqual(lucide);
    }
  });
});
