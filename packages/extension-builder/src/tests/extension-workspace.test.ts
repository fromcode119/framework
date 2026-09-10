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

  it('prefers the extension own node_modules as the toolchain root', () => {
    const dir = join(scratch(), 'numerology');
    mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
    expect(ExtensionWorkspace.resolve(dir, ExtensionKind.PLUGIN).toolchainRoot).toBe(dir);
  });

  it('walks up to the nearest ancestor that has one', () => {
    const root = scratch();
    mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
    const dir = join(root, 'plugins', 'numerology');
    mkdirSync(dir, { recursive: true });
    expect(ExtensionWorkspace.resolve(dir, ExtensionKind.PLUGIN).toolchainRoot).toBe(root);
  });

  it('falls back to the extension itself rather than reaching outside it', () => {
    const dir = join(scratch(), 'numerology');
    mkdirSync(dir, { recursive: true });
    expect(ExtensionWorkspace.resolve(dir, ExtensionKind.PLUGIN).toolchainRoot).toBe(dir);
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
