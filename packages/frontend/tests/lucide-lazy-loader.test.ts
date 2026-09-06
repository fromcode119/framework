// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IconNode } from 'lucide-react';
import { LucideIconAssetUrl } from '@fromcode119/react/icons/lucide-icon-asset-url';
import { LucideLazyLoader } from '@fromcode119/react/icons/lucide-lazy-loader';
import lucideIconNames from '@fromcode119/react/icons/lucide-icon-names.generated.json';

/**
 * The browser-side icon loader, decoupled from lucide's import table:
 *   - the full export-name surface still comes from the generated names alone;
 *   - an icon's URL is this app's own origin + `/fc-runtime/icons/<version>/<kebab>.js`, under the
 *     admin base path when the document is the admin (`RuntimeLocationUtils.toAdminPath`);
 *   - a fetched data module becomes a real lucide component through the ONE bundled `createLucideIcon`.
 */
class LoaderFixture {
  static readonly chevronDown: IconNode = [['path', { d: 'm6 9 6 6 6-6', key: 'qrunsl' }]];

  /** Point `window.location` at `url` (vitest's jsdom global is configurable; jsdom's own is not). */
  static visit(url: string): void {
    vi.stubGlobal('location', new URL(url));
  }

  static async settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('LucideLazyLoader name surface', () => {
  it('exposes every icon in all three export forms, from the generated names alone', () => {
    expect(LucideLazyLoader.has('ChevronDown')).toBe(true);
    expect(LucideLazyLoader.has('ChevronDownIcon')).toBe(true);
    expect(LucideLazyLoader.has('LucideChevronDown')).toBe(true);
    expect(LucideLazyLoader.has('NotAnIcon')).toBe(false);
    // Three export forms per DISTINCT PascalCase name: a few kebab keys are aliases of one another
    // (`alarm-check` / `alarm-clock-check`), which is exactly how lucide's own namespace collapses them.
    const distinct = new Set(lucideIconNames.names.map((kebab) => kebab.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(''))).size;
    expect(LucideLazyLoader.iconNames().length).toBe(distinct * 3);
  });
});

describe('LucideIconAssetUrl', () => {
  it('is served by the storefront from its own origin and root', () => {
    LoaderFixture.visit('http://frontend.framework.local/some/page?x=1');
    expect(LucideIconAssetUrl.for('chevron-down')).toBe(`http://frontend.framework.local/fc-runtime/icons/${lucideIconNames.lucideReact}/chevron-down.js`);
  });

  it('is served by the admin from its own origin under its base path', () => {
    LoaderFixture.visit('http://admin.framework.local/admin/settings/general');
    expect(LucideIconAssetUrl.for('chevron-down')).toBe(`http://admin.framework.local/admin/fc-runtime/icons/${lucideIconNames.lucideReact}/chevron-down.js`);
    LoaderFixture.visit('http://localhost:3001/admin/dashboard');
    expect(LucideIconAssetUrl.for('chevron-down')).toBe(`http://localhost:3001/admin/fc-runtime/icons/${lucideIconNames.lucideReact}/chevron-down.js`);
  });

  it('is served by a ROOT-served admin (no base path, as the local stack runs it) from its origin root', () => {
    LoaderFixture.visit('http://admin.framework.local/settings/general');
    expect(LucideIconAssetUrl.for('chevron-down')).toBe(`http://admin.framework.local/fc-runtime/icons/${lucideIconNames.lucideReact}/chevron-down.js`);
  });

  it('carries the version the generated names declare', () => {
    expect(LucideIconAssetUrl.version).toBe(lucideIconNames.lucideReact);
  });
});

describe('LucideLazyLoader loading', () => {
  it('fetches the data module once and builds a real lucide component with createLucideIcon', async () => {
    LoaderFixture.visit('http://frontend.framework.local/');
    const fetchIconNode = vi.spyOn(LucideLazyLoader, 'fetchIconNode').mockResolvedValue(LoaderFixture.chevronDown);
    const loaded = vi.fn();
    const unsubscribe = LucideLazyLoader.subscribe(loaded);
    const before = LucideLazyLoader.getRevision();

    expect(LucideLazyLoader.get('ChevronDown')).toBeNull();
    expect(LucideLazyLoader.get('ChevronDownIcon')).toBeNull();
    expect(fetchIconNode).toHaveBeenCalledTimes(1);
    expect(fetchIconNode).toHaveBeenCalledWith('chevron-down');

    await LoaderFixture.settle();
    const Icon = LucideLazyLoader.get('LucideChevronDown');
    expect(Icon).not.toBeNull();
    expect(LucideLazyLoader.getRevision()).toBe(before + 1);
    expect(loaded).toHaveBeenCalledTimes(1);
    unsubscribe();

    const markup = renderToStaticMarkup(createElement(Icon!, { size: 16, className: 'x' }));
    expect(markup).toContain('<svg');
    expect(markup).toContain('lucide-chevron-down');
    expect(markup).toContain('d="m6 9 6 6 6-6"');
    expect(markup).toContain('width="16"');
  });
});
