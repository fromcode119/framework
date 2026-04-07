import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicRouteProxy } from '../lib/public-route-proxy';
import { GET as getPublicXmlRoute } from '../app/[publicRoute].xml/route';
import { GET as getMainSitemap } from '../app/sitemap.xml/route';

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

    const result = await getPublicXmlRoute(new Request('https://frontend.example.com/feed.xml'), {
      params: Promise.resolve({ publicRoute: 'feed' }),
    });

    expect(PublicRouteProxy.getResponse).toHaveBeenCalledWith('feed.xml');
    expect(result).toBe(response);
  });

  it('delegates a generic directory xml route to the shared public route proxy', async () => {
    const response = new Response('<directory />');
    vi.spyOn(PublicRouteProxy, 'getResponse').mockResolvedValue(response);

    const result = await getPublicXmlRoute(new Request('https://frontend.example.com/directory.xml'), {
      params: Promise.resolve({ publicRoute: 'directory' }),
    });

    expect(PublicRouteProxy.getResponse).toHaveBeenCalledWith('directory.xml');
    expect(result).toBe(response);
  });

  it('delegates a generic catalog xml route to the shared public route proxy', async () => {
    const response = new Response('<catalog />');
    vi.spyOn(PublicRouteProxy, 'getResponse').mockResolvedValue(response);

    const result = await getPublicXmlRoute(new Request('https://frontend.example.com/catalog.xml'), {
      params: Promise.resolve({ publicRoute: 'catalog' }),
    });

    expect(PublicRouteProxy.getResponse).toHaveBeenCalledWith('catalog.xml');
    expect(result).toBe(response);
  });
});