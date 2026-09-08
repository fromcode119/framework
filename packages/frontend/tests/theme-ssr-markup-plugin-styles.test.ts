import { describe, expect, it } from 'vitest';
import { ThemeSsrMarkup } from '@/lib/ssr/theme-ssr-markup';

/**
 * A plugin ships the default design for its own blocks and injects that sheet with `head.prepend`, so
 * a theme can rebrand the block with plain single-class rules that win the tie on load order. During a
 * server render there is no document to prepend into, so the plugin emits the CSS inline — in the BODY,
 * after the theme's stylesheet, which inverts the tie. The page then paints with the plugin's own
 * defaults and visibly re-styles itself the moment the browser boots and prepends the real sheet.
 *
 * Lifting the tag out of the body is what puts it back in front of the theme's stylesheet.
 */
describe('ThemeSsrMarkup plugin default styles', () => {
  const STYLE = '<style data-fc-plugin-default="beta-collection">.fc-collection{padding:0}</style>';

  it('lifts a plugin default sheet out of the body', () => {
    const markup = ThemeSsrMarkup.from(`<main>${STYLE}<div>cards</div></main>`);

    expect(markup.bodyHtml).not.toContain('<style');
    expect(markup.bodyHtml).toContain('<div>cards</div>');
    expect(markup.pluginStyles).toHaveLength(1);
    expect(markup.pluginStyles[0].key).toBe('beta-collection');
    expect(markup.pluginStyles[0].css).toBe('.fc-collection{padding:0}');
  });

  it('keeps ONE copy when a page renders the same block twice', () => {
    const markup = ThemeSsrMarkup.from(`<main>${STYLE}<hr/>${STYLE}</main>`);

    expect(markup.pluginStyles).toHaveLength(1);
  });

  it('gives each plugin sheet its own hoist identity', () => {
    const other = '<style data-fc-plugin-default="theta-form">.fc-form{gap:0}</style>';

    const markup = ThemeSsrMarkup.from(`<main>${STYLE}${other}</main>`);

    expect(markup.pluginStyles.map((style) => style.href)).toEqual([
      'fc-plugin-default-beta-collection',
      'fc-plugin-default-theta-form',
    ]);
  });

  it('leaves emotion styles to their own group — the two are hoisted separately', () => {
    const emotion = '<style data-emotion="css 1a2b">.css-1a2b{color:red}</style>';

    const markup = ThemeSsrMarkup.from(`<main>${emotion}${STYLE}</main>`);

    expect(markup.styleGroups).toHaveLength(1);
    expect(markup.pluginStyles).toHaveLength(1);
    expect(markup.bodyHtml).not.toContain('<style');
  });

  it('reports no plugin sheets for a page that renders none', () => {
    const markup = ThemeSsrMarkup.from('<main><div>cards</div></main>');

    expect(markup.pluginStyles).toEqual([]);
  });
});
