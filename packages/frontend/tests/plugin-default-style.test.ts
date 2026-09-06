import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PluginDefaultStyle } from '@fromcode119/react/view/plugin-default-style';
import { ThemeSsrMarkup } from '@/lib/ssr/theme-ssr-markup';

/**
 * A plugin's default sheet must reach the FIRST paint: the server render emits it with the framework's
 * marker and `ThemeSsrMarkup` lifts it into <head>. A renderer that only injected on mount painted its
 * block unstyled on the server and reflowed at hydration (0.64 CLS on the client site's contact page).
 */
describe('PluginDefaultStyle', () => {
  const css = '.fc-demo { display: grid; }';

  it('emits the sheet inline with the plugin-default marker during a server render', () => {
    const html = renderToStaticMarkup(createElement(PluginDefaultStyle, { styleKey: 'demo-surface', css }));
    expect(html).toBe(`<style ${PluginDefaultStyle.ATTRIBUTE}="demo-surface">${css}</style>`);
  });

  it('is lifted out of the body into the head sheets, once per key', () => {
    const block = renderToStaticMarkup(
      createElement('section', { className: 'fc-demo' }, createElement(PluginDefaultStyle, { styleKey: 'demo-surface', css }), 'body'),
    );
    const markup = ThemeSsrMarkup.from(block + block);
    expect(markup.pluginStyles.map((style) => [style.key, style.css])).toEqual([['demo-surface', css]]);
    expect(markup.bodyHtml).not.toContain('<style');
    expect(markup.bodyHtml).toContain('<section class="fc-demo">body</section>');
  });

  it('does nothing outside a browser when asked to inject', () => {
    expect(() => PluginDefaultStyle.inject('demo-surface', css)).not.toThrow();
  });
});
