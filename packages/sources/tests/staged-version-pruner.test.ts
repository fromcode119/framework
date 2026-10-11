import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExtensionScope } from '@fromcode119/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PackageBuilder } from '@sources/packaging/package-builder';
import { StagedVersionPruner } from '@sources/packaging/staged-version-pruner';

/**
 * Every build staged a whole package and nothing removed one: a single theme kept 46 versions at
 * 258 MB each on a production disk. After a build only the newest few stay.
 */
describe('StagedVersionPruner', () => {
  let out: string;
  let builder: PackageBuilder;
  const stage = (name: string) => fs.mkdirSync(path.join(out, 'themes', 'packages', name), { recursive: true });
  const staged = () => fs.readdirSync(path.join(out, 'themes', 'packages')).sort();

  beforeEach(() => {
    out = fs.mkdtempSync(path.join(os.tmpdir(), 'pruner-'));
    builder = new PackageBuilder(path.join(out, 'plugins'), path.join(out, 'themes'), path.join(out, 'core'), path.join(out, 'appearances'));
    for (const name of ['shop-1.0.9', 'shop-1.0.10', 'shop-1.0.11', 'shop-1.0.12', 'shop-1.0.13', 'shop-extra-0.1.0', 'other-2.0.0']) stage(name);
  });
  afterEach(() => fs.rmSync(out, { recursive: true, force: true }));

  it('keeps the newest N of the built extension and touches no other extension', async () => {
    const removed = await new StagedVersionPruner(builder, async () => 3, () => undefined).prune(ExtensionScope.THEME, 'shop', '1.0.13');

    expect(removed.sort()).toEqual(['1.0.10', '1.0.9']);
    expect(staged()).toEqual(['other-2.0.0', 'shop-1.0.11', 'shop-1.0.12', 'shop-1.0.13', 'shop-extra-0.1.0']);
  });

  it('always keeps the version just built, even when it is not among the newest', async () => {
    await new StagedVersionPruner(builder, async () => 1, () => undefined).prune(ExtensionScope.THEME, 'shop', '1.0.9');

    expect(staged()).toEqual(['other-2.0.0', 'shop-1.0.13', 'shop-1.0.9', 'shop-extra-0.1.0']);
  });

  it('removes nothing when the setting is empty or not a whole number of at least 1', async () => {
    for (const keep of [null, 0, 2.5]) {
      await new StagedVersionPruner(builder, async () => keep, () => undefined).prune(ExtensionScope.THEME, 'shop', '1.0.13');
    }
    expect(staged()).toHaveLength(7);
  });
});
