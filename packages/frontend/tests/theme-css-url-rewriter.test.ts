import { describe, expect, it } from 'vitest';
import { ThemeCssUrlRewriter } from '@/lib/theme/theme-css-url-rewriter';

const sheet = 'http://api.framework.local/api/v1/themes/fromcode/ui/fromcode-theme.css';

describe('ThemeCssUrlRewriter', () => {
  it('resolves relative url() references against the stylesheet URL, as a linked stylesheet would', () => {
    const css = "@font-face { src: url('fonts/a.woff2') format('woff2'); } .x { background: url(images/b.png); } .y { background: url(\"../shared/c.svg\"); }";
    expect(ThemeCssUrlRewriter.rewrite(css, sheet)).toBe(
      "@font-face { src: url('http://api.framework.local/api/v1/themes/fromcode/ui/fonts/a.woff2') format('woff2'); } "
      + '.x { background: url(http://api.framework.local/api/v1/themes/fromcode/ui/images/b.png); } '
      + '.y { background: url("http://api.framework.local/api/v1/themes/fromcode/shared/c.svg"); }',
    );
  });

  it('leaves absolute, root-relative, data, and fragment references untouched', () => {
    const css = "a{src:url(https://x.test/f.woff2)} b{src:url('/api/v1/themes/t/ui/f.woff2')} c{src:url(data:font/woff2;base64,AAAA)} d{fill:url(#grad)}";
    expect(ThemeCssUrlRewriter.rewrite(css, sheet)).toBe(css);
  });

  it('returns the css unchanged without a stylesheet URL', () => {
    expect(ThemeCssUrlRewriter.rewrite('a{src:url(f.woff2)}', '')).toBe('a{src:url(f.woff2)}');
  });
});

describe('ThemeHeadLink href forms', async () => {
  const { ThemeHeadLink } = await import('@/lib/document/theme-head-link');
  const { ApiPathUtils } = await import('@fromcode119/core/client');
  it('resolves absolute, root-relative and bare (theme ui asset) hrefs', () => {
    const api = 'http://api.test';
    expect(ThemeHeadLink.from({ rel: 'preconnect', href: 'https://fonts.gstatic.com' }, api, 'fromcode')?.href).toBe('https://fonts.gstatic.com');
    expect(ThemeHeadLink.from({ rel: 'preload', href: '/api/v1/themes/fromcode/ui/x.webp' }, api, 'fromcode')?.href).toBe('http://api.test/api/v1/themes/fromcode/ui/x.webp');
    expect(ThemeHeadLink.from({ rel: 'preload', href: 'fonts/a.woff2', as: 'font' }, api, 'fromcode')?.href).toBe(ApiPathUtils.themeUiAssetUrl(api, 'fromcode', 'fonts/a.woff2'));
    // Without a theme slug the legacy prefixing stands (a bare href is the caller's responsibility).
    expect(ThemeHeadLink.from({ rel: 'preload', href: 'fonts/a.woff2' }, api)?.href).toBe(`${api}fonts/a.woff2`);
  });
});
