import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MetadataHeadView } from '@/lib/document/metadata-head-view';

const site = {
  title: { default: 'Fromcode', template: '%s | Fromcode' },
  description: 'Site description',
  openGraph: { siteName: 'Fromcode', title: 'Fromcode', type: 'website' },
  twitter: { card: 'summary_large_image' as const, title: 'Fromcode' },
  icons: { icon: '/favicon.ico', shortcut: '/favicon.ico', apple: '/apple-touch-icon.png' },
};

const render = (page: Record<string, unknown>) => renderToStaticMarkup(createElement(MetadataHeadView.render, { page, site }));

describe('MetadataHeadView', () => {
  it('renders an absolute page title, description, canonical, robots, Open Graph, Twitter and icons', () => {
    const html = render({
      title: { absolute: 'Platform | Fromcode' },
      description: 'Page description',
      alternates: { canonical: 'https://fromcode.com/platform' },
      robots: { index: false, follow: true },
      openGraph: { title: 'Platform', description: 'Page description', url: 'https://fromcode.com/platform', siteName: 'Fromcode', type: 'website', images: ['https://fromcode.com/og.png'] },
      twitter: { card: 'summary', title: 'Platform', description: 'Page description', images: ['https://fromcode.com/og.png'], site: '@fromcode' },
      other: { 'fromcode:resolved-type': 'page' },
    });
    expect(html).toContain('<title>Platform | Fromcode</title>');
    expect(html).toContain('<meta name="description" content="Page description"/>');
    expect(html).toContain('<link rel="canonical" href="https://fromcode.com/platform"/>');
    expect(html).toContain('<meta name="robots" content="noindex,follow"/>');
    expect(html).toContain('<meta property="og:title" content="Platform"/>');
    expect(html).toContain('<meta property="og:url" content="https://fromcode.com/platform"/>');
    expect(html).toContain('<meta property="og:site_name" content="Fromcode"/>');
    expect(html).toContain('<meta property="og:image" content="https://fromcode.com/og.png"/>');
    expect(html).toContain('<meta name="twitter:card" content="summary"/>');
    expect(html).toContain('<meta name="twitter:site" content="@fromcode"/>');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>');
    expect(html).toContain('<meta name="fromcode:resolved-type" content="page"/>');
  });

  it('applies the site template to a plain page title and falls back to the site default', () => {
    expect(MetadataHeadView.resolveTitle({ title: 'About' }, site)).toBe('About | Fromcode');
    expect(MetadataHeadView.resolveTitle({}, site)).toBe('Fromcode');
    expect(MetadataHeadView.resolveTitle({ title: { absolute: 'Exact' } }, site)).toBe('Exact');
  });

  it('falls back to the site description, Open Graph and Twitter when the page carries none', () => {
    const html = render({});
    expect(html).toContain('<meta name="description" content="Site description"/>');
    expect(html).toContain('<meta property="og:site_name" content="Fromcode"/>');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"/>');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('name="robots"');
  });
});
