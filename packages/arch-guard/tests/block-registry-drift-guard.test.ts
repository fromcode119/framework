import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockRegistryDriftGuard } from '../src/block-registry-drift-guard';

/** A visual-editor schema is found whether it is a static property or a static getter. */
describe('BlockRegistryDriftGuard', () => {
  let root = '';
  const previous = process.env.PLUGINS_DIR;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = '';
    if (previous === undefined) delete process.env.PLUGINS_DIR;
    else process.env.PLUGINS_DIR = previous;
    vi.restoreAllMocks();
  });

  const plugin = (schemas: string): void => {
    root = mkdtempSync(path.join(tmpdir(), 'block-drift-'));
    const ui = path.join(root, 'shop/src/ui/components');
    mkdirSync(path.join(ui, 'block-registry'), { recursive: true });
    mkdirSync(path.join(ui, 'visual-editor'), { recursive: true });
    mkdirSync(path.join(ui, 'block-editor/blocks'), { recursive: true });
    writeFileSync(path.join(ui, 'block-editor/blocks/index.ts'), '');
    writeFileSync(path.join(ui, 'block-registry/block-registry-entries.ts'),
      "{ type: 'hero', label: 'Hero', adminEditor: false, visualEditor: true },\n{ type: 'cta', label: 'CTA', adminEditor: false, visualEditor: true },");
    writeFileSync(path.join(ui, 'visual-editor/block-schemas-layout.ts'), schemas);
    process.env.PLUGINS_DIR = root;
  };

  it('counts a getter schema the same as a property schema', () => {
    plugin([
      "static readonly HERO: IVisualEditorBlockSchema = { type: 'hero', label: 'Hero', fields: [] };",
      "static get CTA(): IVisualEditorBlockSchema {\n    return {\n      type: 'cta',\n      label: ContextBridge.t('shop.cta', {}, 'CTA'),\n    };\n  }",
    ].join('\n'));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(BlockRegistryDriftGuard.run()).toBe(0);
  });

  it('still reports a registered schema that exists in neither form', () => {
    plugin("static readonly HERO: IVisualEditorBlockSchema = { type: 'hero', label: 'Hero', fields: [] };");
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(BlockRegistryDriftGuard.run()).toBe(1);
  });
});
