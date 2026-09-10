import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ExtensionKind } from '@extension-builder/extension-kind';
import { ExtensionWorkspace } from '@extension-builder/extension-workspace';

function scratch(): string {
  return mkdtempSync(join(tmpdir(), 'ext-ws-'));
}

describe('ExtensionWorkspace', () => {
  it('resolves the served ui/ dir for a plugin', () => {
    const root = scratch();
    const dir = join(root, 'plugins', 'numerology');
    mkdirSync(dir, { recursive: true });
    expect(ExtensionWorkspace.resolve(dir, ExtensionKind.PLUGIN).uiDir).toBe(join(dir, 'ui'));
  });

  it('resolves a clone in a bare temp dir, with no monorepo around it', () => {
    const dir = join(scratch(), 'numerology');
    mkdirSync(dir, { recursive: true });
    const ws = ExtensionWorkspace.resolve(dir, ExtensionKind.PLUGIN);
    expect(ws.sourceDir).toBe(dir);
    expect(ws.uiDir).toBe(join(dir, 'ui'));
  });

  it('resolves each tool SEPARATELY: the plugin has its own node_modules, tailwind is hoisted', () => {
    // Exactly the numerology case. One root for every tool found the plugin's own, declared
    // tailwind "not installed", and silently skipped every stylesheet.
    const root = scratch();
    mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(join(root, 'node_modules', '.bin', 'tailwindcss'), '');
    const dir = join(root, 'plugins', 'numerology');
    mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(join(dir, 'node_modules', '.bin', 'esbuild'), '');

    const ws = ExtensionWorkspace.resolve(dir, ExtensionKind.PLUGIN);
    expect(ws.toolchainRootFor('esbuild')).toBe(dir);
    expect(ws.toolchainRootFor('tailwindcss')).toBe(root);
  });

  it('returns null for a tool nothing on the chain has, so the caller can say so', () => {
    const dir = join(scratch(), 'numerology');
    mkdirSync(dir, { recursive: true });
    expect(ExtensionWorkspace.resolve(dir, ExtensionKind.PLUGIN).toolchainRootFor('terser')).toBeNull();
  });

  it('prefers src/ui as the UI SOURCE, falling back to the legacy ui/ layout', () => {
    const dir = join(scratch(), 'numerology');
    mkdirSync(join(dir, 'src', 'ui'), { recursive: true });
    writeFileSync(join(dir, 'src', 'ui', 'index.ts'), '');
    const ws = ExtensionWorkspace.resolve(dir, ExtensionKind.PLUGIN);
    expect(ws.uiSourceDir).toBe(join(dir, 'src', 'ui'));
    expect(ws.uiDir).toBe(join(dir, 'ui'));
  });
});
