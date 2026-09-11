import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AppearanceCompiler } from '@extension-builder/compile/appearance-compiler';

/**
 * Appearances were the last thing built by a shell script, and the pipeline's stub had pointed at
 * `build-plugins.sh` for weeks after that script was deleted. These pin the parts of the port that
 * are not obvious from reading it.
 */
describe('AppearanceCompiler', () => {
  const scaffold = (files: Record<string, string>): string => {
    const dir = mkdtempSync(join(tmpdir(), 'fc-appearance-'));
    for (const [name, body] of Object.entries(files)) {
      const full = join(dir, name);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, body);
    }
    return dir;
  };

  it('bundles the entry to dist/bundle.js', async () => {
    const dir = scaffold({ 'index.ts': 'export class Appearance { static id = "x"; }\n' });
    const result = await AppearanceCompiler.compile(dir);

    expect(result.failed).toBe(false);
    expect(existsSync(join(dir, 'dist/bundle.js'))).toBe(true);
  });

  /** A directory without an entry is not an appearance, and must say so rather than fail. */
  it('skips a directory with no index.ts, stating why', async () => {
    const result = await AppearanceCompiler.compile(scaffold({ 'readme.md': 'not an appearance' }));

    expect(result.failed).toBe(false);
    expect(result.skippedReason).toContain('index.ts');
  });

  /**
   * React and the SDK are resolved by the admin at runtime. A bundled copy of React is two hook
   * dispatchers in one page; a bundled SDK is two copies of every registry, so the appearance
   * registers itself into one the admin does not read.
   */
  it('leaves react and the SDK out of the bundle', async () => {
    const dir = scaffold({
      'index.ts': "import { useState } from 'react';\nexport const used = useState;\n",
    });
    await AppearanceCompiler.compile(dir);

    expect(readFileSync(join(dir, 'dist/bundle.js'), 'utf8')).toContain('from "react"');
  });

  /** `dist/` is the only directory the admin's asset route serves, so the brand must land there. */
  it('copies the appearance’s own assets into dist', async () => {
    const dir = scaffold({
      'index.ts': 'export class Appearance {}\n',
      'assets/logo.svg': '<svg/>',
    });
    await AppearanceCompiler.compile(dir);

    expect(existsSync(join(dir, 'dist/logo.svg'))).toBe(true);
  });

  it('compiles styles.less to dist/appearance.css when present', async () => {
    const dir = scaffold({
      'index.ts': 'export class Appearance {}\n',
      'styles.less': '@brand: #123456; .a { color: @brand; }',
    });
    await AppearanceCompiler.compile(dir);

    expect(readFileSync(join(dir, 'dist/appearance.css'), 'utf8')).toContain('#123456');
  });
});
