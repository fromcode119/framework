import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactNode } from 'react';
import { PluginContextRegistry } from '@fromcode119/react/plugin-context';
import { PluginWidgetHost, Slot, SlotsContext } from '@fromcode119/react';

/**
 * A plugin WIDGET is a sandboxed frame some plugin's manifest put in a slot — the only way a plugin a
 * site uploaded appears on its storefront. It renders from the descriptor alone, and only where the
 * tree says it is the storefront.
 */
function render(node: ReactNode, widgetHost: boolean, plugins: unknown[]): string {
  return renderToStaticMarkup(
    createElement(PluginWidgetHost.Context.Provider, { value: widgetHost },
      createElement(PluginContextRegistry.Context.Provider, { value: { plugins } as any },
        createElement(SlotsContext.Context.Provider, { value: {} as any }, node))),
  );
}

const plugins = [
  { slug: 'reviews-box', ui: { widgets: [{ slot: 'product.after', path: '/widget', height: 240, title: 'Reviews' }, { slot: 'footer', path: '/news' }] } },
  { slug: 'other', ui: { widgets: [{ slot: 'product.after', path: 'https://evil.test/' }] } },
];

describe('plugin widgets in a slot', () => {
  it('render as a sandboxed frame on one of the plugin\'s own routes, with no referrer', () => {
    const markup = render(createElement(Slot, { name: 'product.after' }), true, plugins);
    expect(markup).toContain('<iframe');
    expect(markup).toContain('sandbox="allow-scripts allow-forms allow-popups"');
    expect(markup).not.toContain('allow-same-origin');
    expect(markup).toContain('src="/api/v1/plugins/reviews-box/widget"');
    expect(markup).toMatch(/referrerpolicy="no-referrer"/i);
    expect(markup).toContain('height="240"');
    expect(markup).toContain('title="Reviews"');
    // A path that is not one of its own routes is not rendered at all.
    expect(markup).not.toContain('evil.test');
    expect(markup.match(/<iframe/g)?.length).toBe(1);
  });

  it('appear only in the slot they name', () => {
    expect(render(createElement(Slot, { name: 'footer' }), true, plugins)).toContain('src="/api/v1/plugins/reviews-box/news"');
    expect(render(createElement(Slot, { name: 'header' }), true, plugins)).not.toContain('<iframe');
  });

  it('never appear outside the storefront — the admin shares Slot and the plugin list', () => {
    expect(render(createElement(Slot, { name: 'product.after' }), false, plugins)).not.toContain('<iframe');
  });

  it('honour the slot\'s include filter, and leave the fallback for a slot with nothing in it', () => {
    const only = (slug: string) => ({ pluginSlug }: { pluginSlug: string }) => pluginSlug === slug;
    expect(render(createElement(Slot, { name: 'product.after', include: only('nobody'), fallback: createElement('i', null, 'EMPTY') }), true, plugins)).toBe('<i>EMPTY</i>');
  });
});
