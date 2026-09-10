import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ThemePackageLayout } from '@core/theme/theme-package-layout';
import { ThemeHeadScriptCompiler } from '@extension-builder/compile/theme-head-script-compiler';

/** A theme whose head script imports a sibling class — the case --bundle exists to handle. */
function themeWithHeadScript(): string {
  const dir = mkdtempSync(join(tmpdir(), 'theme-head-'));
  mkdirSync(join(dir, 'src', 'boot'), { recursive: true });
  writeFileSync(join(dir, 'src', 'boot', 'ledger.ts'), 'export class Ledger { static mark(): string { return "MARKED"; } }\n');
  writeFileSync(
    join(dir, 'src', 'boot', 'head.ts'),
    'import { Ledger } from "./ledger";\nexport class ThemeHead { static start(): void { document.documentElement.dataset.fc = Ledger.mark(); } }\nThemeHead.start();\n',
  );
  return dir;
}

describe('ThemeHeadScriptCompiler', () => {
  it('takes both names from ThemePackageLayout rather than repeating them', () => {
    expect(ThemePackageLayout.HEAD_SCRIPT_SOURCE).toBe('src/boot/head.ts');
    expect(ThemePackageLayout.HEAD_SCRIPT_ARTIFACT).toBe('head.js');
  });

  it('emits a self-contained IIFE — nothing the shipped file has to import', async () => {
    const dir = themeWithHeadScript();
    const result = await ThemeHeadScriptCompiler.compile(dir);
    expect(result.failed).toBe(false);

    const artifact = join(dir, 'ui', ThemePackageLayout.HEAD_SCRIPT_ARTIFACT);
    expect(existsSync(artifact)).toBe(true);

    const out = readFileSync(artifact, 'utf8');
    expect(out).toContain('MARKED');           // the sibling class was inlined
    expect(out).not.toMatch(/^\s*import\s/m);  // ...and nothing is left to fetch
    expect(out).not.toMatch(/\brequire\(/);
  });

  it('says why it skipped instead of silently doing nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'theme-nohead-'));
    const result = await ThemeHeadScriptCompiler.compile(dir);
    expect(result.failed).toBe(false);
    expect(result.skippedReason).toContain(ThemePackageLayout.HEAD_SCRIPT_SOURCE);
  });
});
