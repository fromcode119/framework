import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionTrees } from '../src/cli/extension-trees';
import { FrameworkRoot } from '../src/cli/framework-root';
import { GuardScope } from '../src/cli/guard-scope';

/**
 * An extension tree exists for a run only when that run says where it is. Nothing is found by guessing
 * which directory sits where relative to the framework.
 */
describe('ExtensionTrees', () => {
  let tmp = '';
  const dir = (...parts: string[]): string => {
    const full = path.join(tmp, ...parts);
    mkdirSync(full, { recursive: true });
    return full;
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it('finds no tree when none is declared, even with one beside the framework', () => {
    tmp = mkdtempSync(path.join(tmpdir(), 'extension-trees-'));
    dir('plugins', 'alpha');
    vi.stubEnv('PLUGINS_DIR', '');
    vi.stubEnv(GuardScope.ENV, '');
    expect(ExtensionTrees.dir('plugins')).toBeNull();
  });

  it('reads the runtime variable, resolved from the framework root', () => {
    tmp = mkdtempSync(path.join(tmpdir(), 'extension-trees-'));
    vi.stubEnv(GuardScope.ENV, '');
    vi.stubEnv('THEMES_DIR', dir('elsewhere', 'themes'));
    expect(ExtensionTrees.dir('themes')).toBe(path.join(tmp, 'elsewhere', 'themes'));
    vi.stubEnv('THEMES_DIR', 'relative-themes');
    expect(ExtensionTrees.dir('themes')).toBe(path.resolve(FrameworkRoot.find(), 'relative-themes'));
  });

  it('takes a scoped extension\'s own tree, and no other area', () => {
    tmp = mkdtempSync(path.join(tmpdir(), 'extension-trees-'));
    vi.stubEnv('THEMES_DIR', dir('declared', 'themes'));
    vi.stubEnv(GuardScope.ENV, dir('checkout', 'plugins', 'alpha'));
    expect(ExtensionTrees.dir('plugins')).toBe(path.join(tmp, 'checkout', 'plugins'));
    expect(ExtensionTrees.dir('themes')).toBeNull();
  });

  it('covers no extension when the framework alone is in scope', () => {
    tmp = mkdtempSync(path.join(tmpdir(), 'extension-trees-'));
    vi.stubEnv('PLUGINS_DIR', dir('plugins'));
    vi.stubEnv(GuardScope.ENV, 'framework');
    expect(ExtensionTrees.dirs()).toEqual([]);
  });

  it('refuses a declared tree that does not exist, rather than scanning nothing', () => {
    tmp = mkdtempSync(path.join(tmpdir(), 'extension-trees-'));
    vi.stubEnv(GuardScope.ENV, '');
    vi.stubEnv('PLUGINS_DIR', path.join(tmp, 'missing'));
    expect(() => GuardScope.areas()).toThrow(/do not exist/);
  });
});
