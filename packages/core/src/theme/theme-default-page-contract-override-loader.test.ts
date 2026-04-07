import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ThemeDefaultPageContractOverrideLoader } from './theme-default-page-contract-override-loader';

describe('ThemeDefaultPageContractOverrideLoader', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directoryPath of temporaryDirectories) {
      if (fs.existsSync(directoryPath)) {
        fs.rmSync(directoryPath, { recursive: true, force: true });
      }
    }
    temporaryDirectories.length = 0;
  });

  it('loads overrides from a theme seed module and returns defensive copies', async () => {
    const themeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-overrides-'));
    temporaryDirectories.push(themeDirectory);
    fs.mkdirSync(path.join(themeDirectory, 'seeds'), { recursive: true });
    fs.writeFileSync(
      path.join(themeDirectory, 'seeds', 'theme-default-page-contract-overrides.cjs'),
      [
        'module.exports.getOverrides = function getOverrides() {',
        '  return [{',
        "    contract: { namespace: 'org.fromcode', pluginSlug: 'ecommerce', key: 'store-index' },",
        "    slug: '/shop',",
        "    aliases: ['/numerology'],",
        '    install: true',
        '  }];',
        '};',
      ].join('\n'),
      'utf8',
    );

    const loader = new ThemeDefaultPageContractOverrideLoader();
    const overrides = await loader.load(themeDirectory);

    expect(overrides).toEqual([
      {
        contract: {
          namespace: 'org.fromcode',
          pluginSlug: 'ecommerce',
          key: 'store-index',
        },
        slug: '/shop',
        aliases: ['/numerology'],
        title: undefined,
        themeLayout: undefined,
        recipe: undefined,
        install: true,
      },
    ]);

    overrides[0].aliases?.push('/mutated');
    const reloadedOverrides = await loader.load(themeDirectory);
    expect(reloadedOverrides[0].aliases).toEqual(['/numerology']);
  });

  it('returns an empty list when the theme does not provide overrides', async () => {
    const themeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-overrides-empty-'));
    temporaryDirectories.push(themeDirectory);

    const loader = new ThemeDefaultPageContractOverrideLoader();

    await expect(loader.load(themeDirectory)).resolves.toEqual([]);
  });
});