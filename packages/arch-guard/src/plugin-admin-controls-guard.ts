/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { ExtensionTrees } from './cli/extension-trees';
import { GuardScope } from './cli/guard-scope';

/**
 * A plugin's ADMIN screens draw form controls with the console's own components.
 *
 * The console owns one look and one size for every field (`@fromcode119/sdk/admin`: `Input`, `Select`,
 * `TextArea`, `Checkbox`, `Switch`, `FileDropzone`, …). A raw `<input>`, `<select>` or `<textarea>` in
 * a plugin screen is how a browser-default control, or a field of its own height, gets back in — and
 * the same rule holds for the console itself (`no-raw-form-controls` in the admin package).
 *
 * Not admin, so not covered: a file whose name carries `.storefront.` or ends in `-renderer.tsx`, and
 * the few public, customer-facing files in {@link PUBLIC_FILES}. A file input is allowed everywhere:
 * it is hidden and opened by a button, so it is not a visible control.
 */
export class PluginAdminControlsGuard {
  /**
   * Public / customer-facing files that carry no `.storefront.` in their name, as
   * `<plugin>/<path under src/ui>`, each with the reason it is not an admin screen.
   */
  static readonly PUBLIC_FILES: Readonly<Record<string, string>> = {
    'ecommerce/account-address-form.tsx': 'customer account page, mounted by account-addresses-panel.storefront.tsx',
    'ecommerce/delivery-address-picker.tsx': 'checkout and product page, used by checkout-flow-form.storefront.tsx',
    'ecommerce/ecommerce-product-addon-options.tsx': 'product page, part of ecommerce-product-detail-view',
    'ecommerce/ecommerce-product-choice-picker.tsx': 'product page, part of ecommerce-product-detail-view',
    'ecommerce/ecommerce-product-detail-view.tsx': 'product page, mounted by ecommerce-product-detail-renderer.storefront.tsx',
    'ecommerce/ecommerce-product-quantity-row.tsx': 'product page, part of ecommerce-product-detail-view',
    'ecommerce/ecommerce-product-variant-picker.tsx': 'product page, part of ecommerce-product-detail-view',
    'mlm/mlm-partner-invoices-card.tsx': 'customer account page, mounted by account-partner-panel.storefront.tsx',
    'mlm/mlm-partners-apply-b2b-section.tsx': 'public partner application, part of mlm-partners-apply-form',
    'mlm/mlm-partners-apply-form.tsx': 'public partner application, mounted by mlm-partners-apply-renderer.storefront.tsx',
    'reminders/reminders-signup-fields.tsx': 'public signup form, used by reminders-signup-form.storefront.tsx',
    'logistics-econt/econt-office-picker.tsx': 'checkout shipping option, slot ecommerce.checkout.shipping_method_options',
    'finance/finance-company-form.tsx': 'customer account page, mounted by finance-account-companies-panel.storefront.tsx',
  };

  private static readonly CONTROL = /<(input|select|textarea)(?=[\s/>])/g;

  static run(): number {
    const hits: string[] = [];
    const perPlugin = new Map<string, number>();
    let scanned = 0;

    for (const plugin of PluginAdminControlsGuard.plugins()) {
      const slug = path.basename(plugin);
      for (const file of PluginAdminControlsGuard.walk(path.join(plugin, 'src', 'ui'))) {
        const inUi = path.relative(path.join(plugin, 'src', 'ui'), file).split(path.sep).join('/');
        if (PluginAdminControlsGuard.isPublic(slug, inUi)) continue;
        scanned += 1;
        for (const hit of PluginAdminControlsGuard.controls(fs.readFileSync(file, 'utf8'))) {
          hits.push(`${ExtensionTrees.show(file)}:${hit.line}  <${hit.tag}>`);
          perPlugin.set(slug, (perPlugin.get(slug) ?? 0) + 1);
        }
      }
    }

    console.log(`Plugin admin controls (raw <input>, <select>, <textarea> in src/ui): ${hits.length} across ${scanned} files.`);
    if (!hits.length) {
      console.log('Plugin admin controls guard passed.');
      return 0;
    }
    console.error(hits.join('\n'));
    console.error(`\n${[...perPlugin].map(([slug, count]) => `${slug}: ${count}`).join(', ')}`);
    console.error(
      '\nDraw the control with the console component from `@fromcode119/sdk/admin` (Input, Select, TextArea,'
      + '\nCheckbox, Switch, FileDropzone, …). A file input opened by a button is allowed; a storefront file'
      + '\nis named `*.storefront.tsx` or `*-renderer.tsx`.',
    );
    return 1;
  }

  /** The plugin directories this run covers: the one named by the scope, or every plugin in the tree. */
  private static plugins(): string[] {
    const roots = GuardScope.areas().filter((entry) => entry.area === 'plugins');
    if (GuardScope.isExtension()) return roots.map((entry) => entry.dir);
    return roots.flatMap((entry) => fs.readdirSync(entry.dir, { withFileTypes: true })
      .filter((child) => child.isDirectory())
      .map((child) => path.join(entry.dir, child.name)));
  }

  private static isPublic(slug: string, inUi: string): boolean {
    const name = path.posix.basename(inUi);
    return name.includes('.storefront.') || name.endsWith('-renderer.tsx') || `${slug}/${inUi}` in PluginAdminControlsGuard.PUBLIC_FILES;
  }

  private static walk(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    return entries.flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' ? [] : PluginAdminControlsGuard.walk(full);
      return entry.name.endsWith('.tsx') && !/\.test\.tsx$/.test(entry.name) ? [full] : [];
    });
  }

  /** Every raw control in a source text, comments blanked out and `type="file"` inputs left out. */
  private static controls(source: string): Array<{ tag: string; line: number }> {
    const code = source.replace(/\/\*[\s\S]*?\*\/|(?<![:'"`])\/\/[^\n]*/g, (comment) => comment.replace(/[^\n]/g, ' '));
    const found: Array<{ tag: string; line: number }> = [];
    for (const match of code.matchAll(PluginAdminControlsGuard.CONTROL)) {
      const start = match.index ?? 0;
      const tag = match[1] ?? '';
      if (tag === 'input' && /\btype=(["'])file\1/.test(PluginAdminControlsGuard.openingTag(code, start))) continue;
      found.push({ tag, line: code.slice(0, start).split('\n').length });
    }
    return found;
  }

  /** The text of one JSX opening tag: up to the first `>` outside braces and quotes. */
  private static openingTag(code: string, start: number): string {
    let depth = 0;
    let quote = '';
    for (let index = start; index < code.length; index++) {
      const char = code[index] ?? '';
      if (quote) {
        if (char === quote) quote = '';
      } else if (char === '"' || char === "'" || (char === '`' && depth > 0)) {
        quote = char;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
      } else if (char === '>' && depth === 0) {
        return code.slice(start, index);
      }
    }
    return code.slice(start);
  }
}
