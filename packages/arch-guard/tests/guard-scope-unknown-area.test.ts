import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GuardScope } from '../src/cli/guard-scope';

describe('GuardScope with a folder outside every area', () => {
  const made: string[] = [];

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  const folder = (...parts: string[]): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-scope-'));
    made.push(root);
    const dir = path.join(root, ...parts);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };

  it('refuses it, rather than letting every guard sweep nothing and pass', () => {
    vi.stubEnv(GuardScope.ENV, folder('scratch', 'shop-fix'));
    expect(() => GuardScope.areas()).toThrow(/not inside one of plugins/);
  });

  it('takes an extension checked out under its area', () => {
    const dir = folder('plugins', 'shop');
    vi.stubEnv(GuardScope.ENV, dir);
    expect(GuardScope.areas()).toEqual([{ area: 'plugins', dir }]);
  });
});
