import { ExtensionScope } from '@fromcode119/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PackageBuilder } from '@sources/packaging/package-builder';

/**
 * Which versions are still on disk, read from the directories themselves.
 *
 * Against a REAL directory rather than a mocked `fs`: the two traps here are both about what the
 * filesystem actually hands back — the ORDER (`readdir` is lexical, so `0.1.9` sorts above `0.1.31`
 * and the newest build would not be at the top of the list) and the PREFIX (slugs contain hyphens,
 * so `forms-` also matches `forms-extra-0.1.0`, which belongs to a different extension).
 */
describe('PackageBuilder — staged versions', () => {
  let root: string;
  let builder: any;

  const stage = (...names: string[]) => {
    for (const name of names) fs.mkdirSync(path.join(root, 'plugins', 'packages', name), { recursive: true });
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'staged-versions-'));
    builder = Object.create(PackageBuilder.prototype);
    builder.outputDirFor = () => path.join(root, 'plugins');
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('lists what is staged, newest first by NUMBER not by text', () => {
    stage('forms-0.1.9', 'forms-0.1.31', 'forms-0.1.20', 'forms-0.2.0');

    expect(builder.listStagedVersions(ExtensionScope.PLUGIN, 'forms'))
      .toEqual(['0.2.0', '0.1.31', '0.1.20', '0.1.9']);
  });

  it('does not claim another extension whose slug starts the same way', () => {
    // `forms-extra` is a different extension. A bare prefix match reads its package as version
    // "extra-0.1.0" of `forms` and offers it for install.
    stage('forms-0.1.31', 'forms-extra-0.1.0');

    expect(builder.listStagedVersions(ExtensionScope.PLUGIN, 'forms')).toEqual(['0.1.31']);
  });

  it('finds a hyphenated slug’s own versions', () => {
    stage('shipping-adapter-0.1.34', 'shipping-adapter-0.1.2');

    expect(builder.listStagedVersions(ExtensionScope.PLUGIN, 'shipping-adapter'))
      .toEqual(['0.1.34', '0.1.2']);
  });

  it('ignores files, counting only staged package directories', () => {
    stage('forms-0.1.31');
    fs.writeFileSync(path.join(root, 'plugins', 'packages', 'forms-0.9.9.zip'), 'not a package');

    expect(builder.listStagedVersions(ExtensionScope.PLUGIN, 'forms')).toEqual(['0.1.31']);
  });

  it('answers an empty list when nothing has ever been built', () => {
    // A missing directory is "nothing built yet", not an error to surface on the screen.
    expect(builder.listStagedVersions(ExtensionScope.PLUGIN, 'forms')).toEqual([]);
  });

  it('answers an empty list for a blank slug rather than listing everything', () => {
    stage('forms-0.1.31');
    expect(builder.listStagedVersions(ExtensionScope.PLUGIN, '  ')).toEqual([]);
  });

  it('keeps prerelease versions in the list and below their release', () => {
    stage('forms-1.0.0', 'forms-1.0.0-rc.1');

    expect(builder.listStagedVersions(ExtensionScope.PLUGIN, 'forms')).toEqual(['1.0.0', '1.0.0-rc.1']);
  });
});
