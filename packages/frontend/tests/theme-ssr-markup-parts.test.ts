import { describe, expect, it } from 'vitest';
import { ThemeSsrMarkup } from '@/lib/ssr/theme-ssr-markup';

/**
 * A render host answers with `toParts()`; the storefront rebuilds the markup with `fromParts()`. The two
 * must be exact inverses, or a page rendered out of process would differ from one rendered in it.
 */
describe('ThemeSsrMarkup parts', () => {
  it('survives the round trip through plain data', () => {
    const html = '<main><style data-emotion="css 1a2b">.css-1a2b{color:red}</style>'
      + '<style data-emotion="css 3c4d">.css-3c4d{margin:0}</style>'
      + '<style data-fc-plugin-default="demo-surface">.fc-demo{padding:0}</style>'
      + '<link rel="preload" as="image" href="/img?src=%2Fx.jpg&amp;w=1400"/><p>Hello <!-- -->world</p></main>';
    const original = ThemeSsrMarkup.from(html, true, ['beta', 'zeta']);
    const parts = original.toParts();
    const rebuilt = ThemeSsrMarkup.fromParts(JSON.parse(JSON.stringify(parts)));

    expect(rebuilt.bodyHtml).toBe(original.bodyHtml);
    expect(rebuilt.styleGroups.map((g) => [g.dataEmotion, g.css, g.href])).toEqual(original.styleGroups.map((g) => [g.dataEmotion, g.css, g.href]));
    expect(rebuilt.pluginStyles.map((s) => [s.key, s.css, s.href])).toEqual(original.pluginStyles.map((s) => [s.key, s.css, s.href]));
    expect(rebuilt.imagePreloads).toEqual(['/img?src=%2Fx.jpg&w=1400']);
    expect(rebuilt.rendersContentSlot).toBe(true);
    expect(rebuilt.usedPlugins).toEqual(['beta', 'zeta']);
    expect(rebuilt.hasBody).toBe(true);
  });
});
