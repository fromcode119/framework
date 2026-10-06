import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeBuildCommandService } from '@cli/services/theme-build-command-service';

/**
 * `atlantis theme build <slug>` looked for the theme under `<project root>/themes` and ignored THEMES_DIR, while
 * `atlantis build theme <slug>` honoured it. With themes kept beside the framework, the first said "Theme
 * directory not found" for a theme the second built.
 */
describe('theme build finds themes where THEMES_DIR says', () => {
  const saved = process.env.THEMES_DIR;
  afterEach(() => { process.env.THEMES_DIR = saved; vi.restoreAllMocks(); });

  it('looks for the theme in the configured themes directory', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlantis-themes-'));
    fs.mkdirSync(path.join(root, 'demo'));
    process.env.THEMES_DIR = root;
    const errors: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { errors.push(args.join(' ')); });
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    await ThemeBuildCommandService.build('demo').catch(() => undefined);
    // The directory was FOUND there (it has no theme.json, which is the next thing reported), not reported missing.
    expect(errors.join('\n')).not.toContain('Theme directory not found');
    expect(errors.join('\n')).toContain(path.join(root, 'demo'));
  });
});
