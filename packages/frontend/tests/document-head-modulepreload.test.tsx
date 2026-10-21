import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocumentHeadView } from '@/lib/document/document-head-view';
import type { ThemeHeadModel } from '@/lib/document/theme-head-model';

/**
 * The islands document boots its runtime on the visitor's first intent, so a parse-time `modulepreload`
 * of the theme entry only downloads script before first paint that nothing on it uses — on a phone that
 * hint alone held the score near 88.
 */
describe('DocumentHeadView', () => {
  it('emits no modulepreload for the theme entry or its chunks', () => {
    const theme = {
      slug: 'demo', apiUrl: 'https://api.example.test', cssVariables: '', inlinedCss: '', fallbackCssHrefs: [],
      preloadLinks: [], elementLinks: [], inlinedBootScript: '', externalStylesheets: [], prefetchScript: '', lcpPreload: null,
      injectorScript: '', versionedEntryUrl: 'https://api.example.test/themes/demo/ui/bundle.js?v=1',
      modulePreloadLinks: ['https://api.example.test/themes/demo/ui/bundle.js?v=1', 'https://api.example.test/themes/demo/ui/chunk-a.js'],
    } as unknown as ThemeHeadModel;
    const html = renderToStaticMarkup(DocumentHeadView.render({
      page: {}, site: {}, theme, markup: null, injections: [], runtimeScriptPath: '/fc-runtime/r.js', layoutInlineCss: '',
    }) as any);
    expect(html).toContain('fromcode:theme-entry');
    expect(html).not.toContain('modulepreload');
  });
});
