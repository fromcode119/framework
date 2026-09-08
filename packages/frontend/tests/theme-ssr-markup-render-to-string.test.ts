import React, { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ThemeSsrMarkup } from '@/lib/ssr/theme-ssr-markup';

/**
 * `ThemeSsrRuntime` renders with `renderToString` (hydratable) rather than `renderToStaticMarkup`. The
 * output differs by React's markers — `<!-- -->` between adjacent text nodes, `<!--$-->`/`<!--/$-->`
 * around a Suspense boundary — and by nothing else, so the regexes `ThemeSsrMarkup` lifts head-bound tags
 * with must keep matching. This renders a real tree (not a hand-written string) through `renderToString`
 * and checks every lift, and that the markers survive in the body untouched.
 */
class RenderToStringFixture {
  static readonly Block = function Block(props: { title: string }): React.ReactElement {
    return createElement('section', { className: 'hero' }, props.title);
  };

  static render(): string {
    return renderToString(
      createElement('main', null,
        // Adjacent text nodes: the separator React needs to hydrate two text fibers.
        createElement('p', null, 'Hello ', 'world'),
        // Emotion's server output and a plugin's default sheet, in the body where React puts them.
        createElement('style', { 'data-emotion': 'css 1a2b' }, '.css-1a2b{color:red}'),
        createElement('style', { 'data-fc-plugin-default': 'beta-collection' }, '.fc-collection{padding:0}'),
        // A theme preloading its LCP image — attribute-escaped `&amp;` in the href.
        createElement('link', { rel: 'preload', as: 'image', href: '/img?src=%2Fx.jpg&w=1400' }),
        // A resolved Suspense boundary, as a warmed override renders.
        createElement(React.Suspense, { fallback: null }, createElement(RenderToStringFixture.Block, { title: 'Hi' })),
      ),
    );
  }
}

describe('ThemeSsrMarkup on renderToString output', () => {
  it('lifts emotion styles, plugin default sheets and image preloads exactly as before', () => {
    const html = RenderToStringFixture.render();
    const markup = ThemeSsrMarkup.from(html);

    expect(markup.styleGroups).toHaveLength(1);
    expect(markup.styleGroups[0].emotionKey).toBe('css');
    expect(markup.pluginStyles).toHaveLength(1);
    expect(markup.pluginStyles[0].key).toBe('beta-collection');
    expect(markup.pluginStyles[0].css).toBe('.fc-collection{padding:0}');
    expect(markup.imagePreloads).toEqual(['/img?src=%2Fx.jpg&w=1400']);

    expect(markup.bodyHtml).not.toContain('<style');
    expect(markup.bodyHtml).not.toContain('<link');
  });

  it('keeps the hydration markers in the body — they are what hydrateRoot matches against', () => {
    const html = RenderToStringFixture.render();
    // The rendered form carries both marker kinds (a static render would carry neither).
    expect(html).toContain('Hello <!-- -->world');
    expect(html).toContain('<!--$--><section class="hero">Hi</section><!--/$-->');

    const markup = ThemeSsrMarkup.from(html);
    expect(markup.bodyHtml).toContain('<p>Hello <!-- -->world</p>');
    expect(markup.bodyHtml).toContain('<!--$--><section class="hero">Hi</section><!--/$-->');
    expect(markup.hasBody).toBe(true);
  });

  it('lifting emotion\'s tag yields exactly the HTML of the tree without it (the client tree)', () => {
    // Emotion inserts its `<style>` immediately before the first ELEMENT that uses the class. In the
    // browser the same tree renders no style tag at all, so the lifted body must equal the render of
    // the tree without it — separators included.
    const style = createElement('style', { 'data-emotion': 'css x' }, '.x{}');
    const withStyle = renderToString(createElement('p', null, 'a', style, createElement('span', { className: 'x' }, 's')));
    const without = renderToString(createElement('p', null, 'a', createElement('span', { className: 'x' }, 's')));
    expect(ThemeSsrMarkup.from(withStyle).bodyHtml).toBe(without);
  });

  it('LIMIT: a tag lifted from between two text nodes merges them', () => {
    // React emits `<!-- -->` only between ADJACENT text nodes; with an element between them it emits
    // none, and lifting that element leaves the two texts fused. Nothing renders a style tag between two
    // text siblings (emotion precedes an element, plugin sheets sit inside their block), so this is a
    // documented limit of the lift, not a case the storefront produces — pinned so a change is noticed.
    const style = createElement('style', { 'data-emotion': 'css x' }, '.x{}');
    expect(renderToString(createElement('p', null, 'a', style, 'b'))).toBe('<p>a<style data-emotion="css x">.x{}</style>b</p>');
    expect(ThemeSsrMarkup.from(renderToString(createElement('p', null, 'a', style, 'b'))).bodyHtml).toBe('<p>ab</p>');
  });
});
