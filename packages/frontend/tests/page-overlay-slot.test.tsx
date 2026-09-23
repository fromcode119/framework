import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactNode } from 'react';
import { PluginContextRegistry } from '@fromcode119/react/plugin-context';
import { SlotsContext } from '@fromcode119/react';
import { DynamicContentClient } from '@/app/components/view/dynamic-content-client.client';
import { HomeClient } from '@/app/components/view/home-client.client';
import { StorefrontContentContract } from '@/lib/storefront-content-contract';

/**
 * A consent banner (or a subscribe popup) must appear on EVERY page. They were mounted in the content
 * slots, which live INSIDE the theme layout — and a layout that renders its own page (a static
 * "about", the account shell) ignores its children, so on those pages the banner did not exist.
 */
function OwnPageLayout(): ReactNode {
  return createElement('main', null, 'THEME-OWN-PAGE');
}
function OverlayMark(): ReactNode {
  return createElement('aside', null, 'OVERLAY-MARK');
}

function renderWithin(node: ReactNode): string {
  const plugins = { themeLayouts: { 'page.default': OwnPageLayout }, activeTheme: { defaultLayout: 'page.default' } };
  const slots = { [StorefrontContentContract.OVERLAY_SLOT]: [{ component: OverlayMark, pluginSlug: 'consent-module', priority: 1 }] };
  return renderToStaticMarkup(
    createElement(PluginContextRegistry.Context.Provider, { value: plugins as any },
      createElement(SlotsContext.Context.Provider, { value: slots as any }, node)),
  );
}

describe('the page-wide overlay renders beside the theme layout', () => {
  it('on a content page whose layout ignores its children', () => {
    const markup = renderWithin(createElement(DynamicContentClient as any, { content: { slug: 'about', title: 'About' } }));
    expect(markup).toContain('THEME-OWN-PAGE');
    expect(markup).toContain('OVERLAY-MARK');
  });

  it('on the home page', () => {
    const markup = renderWithin(createElement(HomeClient as any, { initialContent: { slug: 'home', title: 'Home' } }));
    expect(markup).toContain('THEME-OWN-PAGE');
    expect(markup).toContain('OVERLAY-MARK');
  });
});
