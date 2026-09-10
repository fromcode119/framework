import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ThemeSeedCompiler } from '@extension-builder/compile/theme-seed-compiler';

function themeWithSeed(): string {
  const dir = mkdtempSync(join(tmpdir(), 'theme-seed-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', 'pages.ts'), 'export class Pages { static list(): string[] { return ["SEEDED_MARKER"]; } }\n');
  writeFileSync(join(dir, 'src', 'seed.ts'), 'import { Pages } from "@theme/pages";\nexport class Seed { static run(): string[] { return Pages.list(); } }\n');
  return dir;
}

describe('ThemeSeedCompiler', () => {
  it('resolves @theme, which esbuild does not read from the vite alias', async () => {
    const dir = themeWithSeed();
    const out = join(dir, 'build', 'seed.mjs');
    const result = await ThemeSeedCompiler.compile(dir, out);
    expect(result.failed).toBe(false);
    expect(readFileSync(out, 'utf8')).toContain('SEEDED_MARKER');
  });

  it('sweeps a stale seed a previous build left in the SOURCE tree', async () => {
    const dir = themeWithSeed();
    writeFileSync(join(dir, 'seed.mjs'), 'stale');
    writeFileSync(join(dir, 'seed.cjs'), 'stale');
    await ThemeSeedCompiler.compile(dir, join(dir, 'build', 'seed.mjs'));
    expect(existsSync(join(dir, 'seed.mjs'))).toBe(false);
    expect(existsSync(join(dir, 'seed.cjs'))).toBe(false);
  });

  it('says why it skipped when the theme has no seed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'theme-noseed-'));
    const result = await ThemeSeedCompiler.compile(dir, join(dir, 'build', 'seed.mjs'));
    expect(result.failed).toBe(false);
    expect(result.skippedReason).toContain('src/seed.ts');
  });
});
