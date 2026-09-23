import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PluginScriptGuard } from '../src/plugin-script-guard';
import { FrameworkRoot } from '../src/cli/framework-root';

/**
 * A guard that cannot fail is worth nothing — this repo has been bitten by a scanner reporting a
 * confident zero over files it never opened. Both directions are asserted against a real tree.
 */
describe('PluginScriptGuard', () => {
  const made: string[] = [];
  const tree = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'script-guard-'));
    made.push(root);
    for (const family of ['plugins', 'themes', 'appearance']) fs.mkdirSync(path.join(root, family), { recursive: true });
    fs.mkdirSync(path.join(root, 'plugins', 'billing', 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'themes', 'a-theme'), { recursive: true });
    const original = FrameworkRoot.repo;
    (FrameworkRoot as any).repo = () => root;
    return { root, restore: () => { (FrameworkRoot as any).repo = original; } };
  };

  afterEach(() => { for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  it('passes a tree where no extension carries scripts/', () => {
    const { restore } = tree();
    try { expect(PluginScriptGuard.run()).toBe(0); } finally { restore(); }
  });

  it('fails on a plugin carrying a script', () => {
    const { root, restore } = tree();
    fs.mkdirSync(path.join(root, 'plugins', 'billing', 'scripts'));
    fs.writeFileSync(path.join(root, 'plugins', 'billing', 'scripts', 'repair.mjs'), '// x');
    try { expect(PluginScriptGuard.run()).toBe(1); } finally { restore(); }
  });

  /** An empty directory is still the place one reappears, so it counts. */
  it('fails on an EMPTY scripts/ directory', () => {
    const { root, restore } = tree();
    fs.mkdirSync(path.join(root, 'plugins', 'billing', 'scripts'));
    try { expect(PluginScriptGuard.run()).toBe(1); } finally { restore(); }
  });

  it('covers themes and appearances, not just plugins', () => {
    const { root, restore } = tree();
    fs.mkdirSync(path.join(root, 'themes', 'a-theme', 'scripts'));
    try { expect(PluginScriptGuard.run()).toBe(1); } finally { restore(); }
  });

  it('does not mistake a scripts/ file for a directory', () => {
    const { root, restore } = tree();
    fs.writeFileSync(path.join(root, 'plugins', 'billing', 'scripts'), 'not a directory');
    try { expect(PluginScriptGuard.run()).toBe(1); } finally { restore(); }
  });
});
