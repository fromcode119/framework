import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicRouteProxy } from '@/lib/public-route-proxy';
// Route files export only the class; bind the statics locally.
import { PublicFileRoute } from '@/app/fc-public-route/[file]/route';
import { SitemapRoute } from '@/app/sitemap.xml/route';
const getPublicFileRoute = PublicFileRoute.GET;
const getMainSitemap = SitemapRoute.GET;

describe('Public route handlers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates the root sitemap route to the shared public route proxy', async () => {
    const response = new Response('<root />');
    vi.spyOn(PublicRouteProxy, 'getResponse').mockResolvedValue(response);

    const result = await getMainSitemap();

    expect(PublicRouteProxy.getResponse).toHaveBeenCalledWith('sitemap.xml');
    expect(result).toBe(response);
  });

  it('delegates a generic feed xml route to the shared public route proxy', async () => {
    const response = new Response('<feed />');
    vi.spyOn(PublicRouteProxy, 'getResponse').mockResolvedValue(response);

    const result = await getPublicFileRoute(new Request('https://frontend.example.com/feed.xml'), {
      params: Promise.resolve({ file: 'feed.xml' }),
    });

    expect(PublicRouteProxy.getResponse).toHaveBeenCalledWith('feed.xml');
    expect(result).toBe(response);
  });

  it('delegates a generic directory xml route to the shared public route proxy', async () => {
    const response = new Response('<directory />');
    vi.spyOn(PublicRouteProxy, 'getResponse').mockResolvedValue(response);

    const result = await getPublicFileRoute(new Request('https://frontend.example.com/directory.xml'), {
      params: Promise.resolve({ file: 'directory.xml' }),
    });

    expect(PublicRouteProxy.getResponse).toHaveBeenCalledWith('directory.xml');
    expect(result).toBe(response);
  });

  it('delegates a generic catalog xml route to the shared public route proxy', async () => {
    const response = new Response('<catalog />');
    vi.spyOn(PublicRouteProxy, 'getResponse').mockResolvedValue(response);

    const result = await getPublicFileRoute(new Request('https://frontend.example.com/catalog.xml'), {
      params: Promise.resolve({ file: 'catalog.xml' }),
    });

    expect(PublicRouteProxy.getResponse).toHaveBeenCalledWith('catalog.xml');
    expect(result).toBe(response);
  });

  it('delegates a plugin-declared txt file (e.g. llms.txt) to the shared public route proxy', async () => {
    const response = new Response('# Site');
    vi.spyOn(PublicRouteProxy, 'getResponse').mockResolvedValue(response);

    const result = await getPublicFileRoute(new Request('https://frontend.example.com/llms.txt'), {
      params: Promise.resolve({ file: 'llms.txt' }),
    });

    expect(PublicRouteProxy.getResponse).toHaveBeenCalledWith('llms.txt');
    expect(result).toBe(response);
  });
});
