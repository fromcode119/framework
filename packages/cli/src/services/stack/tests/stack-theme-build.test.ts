import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StackThemeBuild } from '@cli/services/stack/stack-theme-build';

describe('StackThemeBuild', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-theme-build-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('reads the slug from theme.json, never from the directory name', () => {
    const directory = path.join(root, 'ec-change');
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, 'theme.json'), JSON.stringify({ slug: 'shop' }));

    expect(StackThemeBuild.slugOf(directory)).toBe('shop');
  });

  it('puts the built seed beside theme.json, where a site made on the stack runs it', () => {
    const directory = path.join(root, 'theme');
    fs.mkdirSync(directory);
    const built = path.join(root, 'built-seed.mjs');
    fs.writeFileSync(built, 'export default 1;');

    StackThemeBuild.placeSeed(directory, 'shop', built);

    expect(fs.readFileSync(path.join(directory, 'seed.mjs'), 'utf8')).toBe('export default 1;');
  });

  it('leaves the theme alone, and says so, when no seed was built', () => {
    const directory = path.join(root, 'theme');
    fs.mkdirSync(directory);

    StackThemeBuild.placeSeed(directory, 'shop', path.join(root, 'missing.mjs'));

    expect(fs.existsSync(path.join(directory, 'seed.mjs'))).toBe(false);
  });
});
