import { describe, expect, it } from 'vitest';
import { ThemeCssScoper } from '@react/context/theme-css-scoper';

/**
 * The admin mounts the site theme's stylesheet for block previews. Unscoped, a theme's
 * `h1…h6 { font-family: Cinzel, serif }` repainted every block card title in the console.
 */
describe('ThemeCssScoper', () => {
  const url = 'https://console.example.test/api/v1/themes/demo/ui/demo-theme.css?v=1';
  const scopeOf = (css: string) => ThemeCssScoper.scope(css, url);
  const scopedBody = (css: string) => {
    const out = scopeOf(css);
    return out.slice(out.indexOf('@scope'));
  };

  it('confines element rules to the theme surface', () => {
    const out = scopeOf('h1, h2, h4 { font-family: Cinzel, serif; }');
    expect(out).toContain('@scope ([data-fc-theme-surface])');
    expect(scopedBody('h1, h2, h4 { font-family: Cinzel, serif; }')).toContain('h1, h2, h4 { font-family: Cinzel, serif; }');
    expect(out.indexOf('h1')).toBeGreaterThan(out.indexOf('@scope'));
  });

  it('maps html / body / :root to the scope root, keeping document-root conditions', () => {
    const out = scopedBody('body { margin: 0 } html { color: red } :root[data-theme=dark] .card { color: #fff } html:not(.light) .x { a: b }');
    expect(out).toContain(':scope { margin: 0 }');
    expect(out).toContain(':scope { color: red }');
    expect(out).toContain(':root[data-theme=dark] :scope .card { color: #fff }');
    expect(out).toContain(':root:not(.light) :scope .x { a: b }');
  });

  it('keeps @font-face and @keyframes at the top level and rewrites selectors inside @media', () => {
    const out = scopeOf('@font-face { font-family: X; src: url(fonts/x.woff2) } @keyframes spin { to { transform: rotate(1turn) } } @media (min-width: 600px) { body { padding: 1px } .a { b: c } }');
    const scopeAt = out.indexOf('@scope');
    expect(out.indexOf('@font-face')).toBeLessThan(scopeAt);
    expect(out.indexOf('@keyframes')).toBeLessThan(scopeAt);
    expect(out).toContain('url(https://console.example.test/api/v1/themes/demo/ui/fonts/x.woff2)');
    expect(out.slice(scopeAt)).toMatch(/@media \(min-width: 600px\) \{\s*:scope \{ padding: 1px \}\s*\.a \{ b: c \}\s*\}/);
  });

  it('leaves absolute, data and root-relative urls resolvable', () => {
    const out = scopeOf('.a { background: url("data:image/png;base64,AA") } .b { background: url(/img/b.png) } .c { background: url(https://cdn.test/c.png) }');
    expect(out).toContain('url("data:image/png;base64,AA")');
    expect(out).toContain('url(https://console.example.test/img/b.png)');
    expect(out).toContain('url(https://cdn.test/c.png)');
  });

  it('does not split on braces or commas inside strings, comments and functions', () => {
    const out = scopedBody('/* a { b } */ .q::before { content: "}{,"; } .r:is(.s, .t) { u: v }');
    expect(out).toContain('.q::before { content: "}{,"; }');
    expect(out).toContain('.r:is(.s, .t) { u: v }');
  });
});
