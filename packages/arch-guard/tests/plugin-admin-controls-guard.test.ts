import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PluginAdminControlsGuard } from '../src/plugin-admin-controls-guard';
import { GuardScope } from '../src/cli/guard-scope';

/**
 * A guard that cannot fail is worth nothing: both directions are asserted against a real tree.
 */
describe('PluginAdminControlsGuard', () => {
  const made: string[] = [];
  const quiet = () => { vi.spyOn(console, 'log').mockImplementation(() => undefined); vi.spyOn(console, 'error').mockImplementation(() => undefined); };

  /** A plugins tree with one plugin per entry of `files`, each file given as `<slug>/<path under src/ui>`. */
  const tree = (files: Record<string, string>) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-controls-'));
    made.push(root);
    for (const area of ['plugins', 'themes', 'appearance']) fs.mkdirSync(path.join(root, area), { recursive: true });
    for (const [name, text] of Object.entries(files)) {
      const file = path.join(root, 'plugins', name.split('/')[0] ?? '', 'src', 'ui', ...name.split('/').slice(1));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
    }
    vi.stubEnv(GuardScope.ENV, '');
    vi.stubEnv('PLUGINS_DIR', path.join(root, 'plugins'));
    vi.stubEnv('THEMES_DIR', path.join(root, 'themes'));
    vi.stubEnv('APPEARANCE_DIR', path.join(root, 'appearance'));
    return root;
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('passes a screen built from console components', () => {
    quiet();
    tree({ 'shop/orders.tsx': 'export class A { render() { return <Input value="x" />; } }' });
    expect(PluginAdminControlsGuard.run()).toBe(0);
  });

  it.each(['input', 'select', 'textarea'])('fails on a raw <%s>', (tag) => {
    quiet();
    tree({ 'shop/orders.tsx': `export class A { render() { return <${tag} className="x" />; } }` });
    expect(PluginAdminControlsGuard.run()).toBe(1);
  });

  it('allows a hidden file input, even when its attributes hold an arrow function', () => {
    quiet();
    tree({ 'shop/upload.tsx': '<input type="file" hidden onChange={(e) => this.pick(e.target.files)} />' });
    expect(PluginAdminControlsGuard.run()).toBe(0);
  });

  it('fails on a radio even though a file input sits beside it', () => {
    quiet();
    tree({ 'shop/mixed.tsx': '<input type="file" />\n<input type="radio" />' });
    expect(PluginAdminControlsGuard.run()).toBe(1);
  });

  it('skips storefront and renderer files', () => {
    quiet();
    tree({
      'shop/cart.storefront.tsx': '<input />',
      'shop/blocks/hero-renderer.tsx': '<select></select>',
    });
    expect(PluginAdminControlsGuard.run()).toBe(0);
  });

  it('ignores a control named only in a comment', () => {
    quiet();
    tree({ 'shop/note.tsx': '// replaces the old <input>\n/* <textarea> */\nexport const x = 1;' });
    expect(PluginAdminControlsGuard.run()).toBe(0);
  });

  it('reads only src/ui', () => {
    quiet();
    const root = tree({});
    fs.mkdirSync(path.join(root, 'plugins', 'shop', 'src', 'other'), { recursive: true });
    fs.writeFileSync(path.join(root, 'plugins', 'shop', 'src', 'other', 'x.tsx'), '<input />');
    expect(PluginAdminControlsGuard.run()).toBe(0);
  });

  it('narrows to the one plugin a scope names', () => {
    quiet();
    const root = tree({ 'clean/a.tsx': '<Input />', 'dirty/a.tsx': '<input />' });
    vi.stubEnv(GuardScope.ENV, path.join(root, 'plugins', 'clean'));
    expect(PluginAdminControlsGuard.run()).toBe(0);
    vi.stubEnv(GuardScope.ENV, path.join(root, 'plugins', 'dirty'));
    expect(PluginAdminControlsGuard.run()).toBe(1);
  });

  it('leaves out what a customer-facing file imports, without being told its name', () => {
    quiet();
    tree({
      'shop/panel.storefront.tsx': "import { AddressForm } from './address-form';\nexport class P { render() { return <AddressForm />; } }",
      'shop/address-form.tsx': 'export class AddressForm { render() { return <input value="x" />; } }',
    });
    expect(PluginAdminControlsGuard.run()).toBe(0);
  });

  it('leaves out a file registered only in slots outside the console', () => {
    quiet();
    tree({ 'shop/office-picker.tsx': "export class O { static slots = ['checkout.shipping_options']; render() { return <input value=\"x\" />; } }" });
    expect(PluginAdminControlsGuard.run()).toBe(0);
  });

  it('still reports a file registered in a console slot', () => {
    quiet();
    tree({ 'shop/panel.tsx': "export class O { static slots = ['admin.collection.orders.edit.top']; render() { return <select />; } }" });
    expect(PluginAdminControlsGuard.run()).toBe(1);
  });
});
