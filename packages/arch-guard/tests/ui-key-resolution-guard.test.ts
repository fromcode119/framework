import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { UiKeyResolutionGuard } from '../src/ui-key-resolution-guard';

/** A key the screen asks for that no dictionary holds renders its English fallback in every language. */
describe('UiKeyResolutionGuard', () => {
  let root = '';

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = '';
  });

  const extension = (files: Record<string, string>): string => {
    root = mkdtempSync(path.join(tmpdir(), 'ui-keys-'));
    const dir = path.join(root, 'shop');
    for (const [name, body] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      writeFileSync(path.join(dir, name), body);
    }
    return dir;
  };

  it('resolves UI keys, slug-scoped server keys and shared framework keys; reports the rest', () => {
    const dir = extension({
      'manifest.json': JSON.stringify({ slug: 'shop' }),
      'src/ui/i18n/en.json': JSON.stringify({ shop: { orders: { title: 'Orders' } } }),
      'src/i18n/en.json': JSON.stringify({ dashboard: { total: 'Total' } }),
      'src/ui/page.tsx': [
        "this.t('shop.orders.title', {}, 'Orders');",
        "this.t('shop.dashboard.total', {}, 'Total');",
        "this.tr('dashboard.total');",
        "this.t('account.save', {}, 'Save');",
        "this.t('shop.dashboard.byServiceTitle', {}, 'By service');",
        'this.t(`shop.${kind}.title`);',
      ].join('\n'),
    });
    expect(UiKeyResolutionGuard.extensions(root)).toEqual([dir]);
    expect(UiKeyResolutionGuard.unresolvedIn(dir, new Set(['account.save']))).toEqual(['src/ui/page.tsx:5 shop.dashboard.byServiceTitle']);
  });

  it('leaves an extension without a UI dictionary to the report-only guards', () => {
    extension({ 'manifest.json': JSON.stringify({ slug: 'shop' }), 'src/ui/page.tsx': "this.t('shop.x.y');" });
    expect(UiKeyResolutionGuard.extensions(root)).toEqual([]);
  });
});
