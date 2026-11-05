import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FromcodeThemeOverridesPlugin } from '@sdk/vite/fromcode-theme-overrides-plugin';

describe('theme override scan', () => {
  let root = '';
  afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });

  it('skips tests beside the renderers — they import test tooling and are not components', () => {
    root = mkdtempSync(join(tmpdir(), 'fc-theme-scan-'));
    mkdirSync(join(root, 'blocks', 'tests'), { recursive: true });
    mkdirSync(join(root, '__tests__'), { recursive: true });
    writeFileSync(join(root, 'blocks', 'hero.tsx'), '');
    writeFileSync(join(root, 'blocks', 'hero.test.tsx'), '');
    writeFileSync(join(root, 'blocks', 'hero.spec.tsx'), '');
    writeFileSync(join(root, 'blocks', 'tests', 'shell.tsx'), '');
    writeFileSync(join(root, '__tests__', 'x.tsx'), '');

    const found = (FromcodeThemeOverridesPlugin as any).scanOverrideFiles(root) as string[];
    expect(found).toEqual([join(root, 'blocks', 'hero.tsx')]);
  });
});

describe('theme entry globs', () => {
  it('exclude tests from the declared component globs', async () => {
    const { ThemeEntryGenerator } = await import('@sdk/vite/theme-entry-generator');
    const dir = mkdtempSync(join(tmpdir(), 'fc-theme-entry-'));
    try {
      writeFileSync(join(dir, 'theme.json'), JSON.stringify({ build: { components: ['./cms/renderers/**/*.tsx'] } }));
      const source = readFileSync(ThemeEntryGenerator.generate(dir), 'utf8') as string;
      expect(source).toContain('"./cms/renderers/**/*.tsx","!./**/*.test.*"');
      expect(source).toContain('"!./**/tests/**"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
