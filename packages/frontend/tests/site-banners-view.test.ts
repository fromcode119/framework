import { describe, expect, it } from 'vitest';
import { createElement, Fragment, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiteBannersView } from '@/lib/document/site-banners-view';
import { SitePreviewBannerView } from '@/lib/document/site-preview-banner-view';
import { SiteEnvironmentBannerView } from '@/lib/document/site-environment-banner-view';

/**
 * Both status bars can be true at once, and they used to be laid out on top of each other.
 *
 * Each was `position: fixed; bottom: 0`, so an unpublished AND non-production site rendered two bars
 * in the same place — the second covering the first — while the `padding-bottom` that keeps a bar off
 * the page's own content reserved only one bar's height. Read from the DOM it looked like ONE banner
 * rendered twice, and was reported as exactly that, three times, by three different readers.
 *
 * The bars now sit in a container that stacks them, and the stylesheet they share is written once
 * rather than once per visible bar.
 *
 * Written as `.test.ts` and not `.test.tsx` deliberately: the frontend vitest project includes only
 * `tests/**\/*.test.ts`, so a `.tsx` file here is collected by NO project and silently never runs.
 */
describe('SiteBannersView', () => {
  const bars = (preview: boolean, nonProduction: boolean): ReactNode[] => [
    SitePreviewBannerView.render({ visible: preview }),
    SiteEnvironmentBannerView.render({ visible: nonProduction }),
  ];

  const markup = (list: readonly ReactNode[]): string =>
    renderToStaticMarkup(createElement(Fragment, null, SiteBannersView.render({ bars: list })));

  it('renders NOTHING when no bar has anything to say', () => {
    // A hidden bar is null here. As CHILDREN the elements would always be present and only their
    // output null, so a count would say "two bars" on a page showing none — which is exactly what an
    // earlier version of this did, and what this test caught.
    const html = markup(bars(false, false));

    expect(html).toBe('');
  });

  it('writes the shared stylesheet ONCE when both bars show', () => {
    expect(markup(bars(true, true)).split('<style').length - 1).toBe(1);
  });

  it('puts both bars in one container, so they stack instead of covering each other', () => {
    const html = markup(bars(true, true));

    expect(html.split('fc-site-banners').length - 1).toBe(1);
    expect(html).toContain('fc-site-preview--unpublished');
    expect(html).toContain('fc-site-preview--non-production');
  });

  it('still renders a single bar alone — the islands document shows only the preview one', () => {
    const html = markup([SitePreviewBannerView.render({ visible: true })]);

    expect(html).toContain('fc-site-preview--unpublished');
    expect(html).not.toContain('fc-site-preview--non-production');
  });
});
