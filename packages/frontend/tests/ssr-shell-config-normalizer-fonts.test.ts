import { describe, it, expect } from 'vitest';
import { SsrShellConfigNormalizer } from '../lib/ssr-shell/ssr-shell-config-normalizer';

/**
 * `fonts` feeds `<link rel=preload as=font>`. A preload only pays off when its url is
 * byte-identical to the url the theme's `@font-face` later requests, so a theme whose css
 * uses ROOT-RELATIVE font urls must be able to declare that same spelling here — the
 * previous ui-path-only rule silently dropped them, and the api-origin form the framework
 * substituted instead was never matched by the css (every preloaded face downloaded twice).
 */
const normalizeFonts = (fonts: unknown): string[] =>
  SsrShellConfigNormalizer.normalize({ templates: [{ template: 't.html' }], fonts })?.fonts ?? [];

describe('SsrShellConfigNormalizer fonts', () => {
  it('keeps a root-relative same-origin path verbatim', () => {
    expect(normalizeFonts(['/api/v1/themes/acme/ui/fonts/x.woff2']))
      .toEqual(['/api/v1/themes/acme/ui/fonts/x.woff2']);
  });

  it('keeps bare theme ui paths and absolute http(s) urls', () => {
    expect(normalizeFonts(['fonts/x.woff2', 'https://cdn.example.com/x.woff2']))
      .toEqual(['fonts/x.woff2', 'https://cdn.example.com/x.woff2']);
  });

  it('rejects protocol-relative urls, which are a FOREIGN origin, not a path', () => {
    expect(normalizeFonts(['//evil.example.com/x.woff2'])).toEqual([]);
  });

  it('rejects traversal in both bare and root-relative form', () => {
    expect(normalizeFonts(['../../etc/passwd', '/api/../../etc/passwd'])).toEqual([]);
  });

  it('drops non-strings, blanks and unsafe charsets', () => {
    expect(normalizeFonts([42, '', '   ', null, '/api/v1/f.woff2?x=<script>'])).toEqual([]);
  });
});
