import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleUrlStrategy } from '@fromcode119/core/client';
import { StorefrontDocumentRenderer } from '@/lib/document/storefront-document-renderer';
import { StorefrontDocumentRequest } from '@/lib/document/storefront-document-request';
import { DocumentRenderTiming } from '@/lib/document/document-render-timing';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { AccountRouteGuard } from '@/lib/account-route-guard';
import { HomePageResolver } from '@/app/home-page-resolver';

/**
 * The document speaks the language its address names. It once read only the cookie and the site's
 * default, so `?locale=bg` — the address `hreflang` advertises — answered `<html lang>` in the default.
 */
describe('StorefrontDocumentRenderer locale', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  async function localeOf(path: string[], query: string, strategy: LocaleUrlStrategy): Promise<string> {
    vi.spyOn(DynamicPageResolver, 'getLocaleRoutingConfig').mockResolvedValue({ strategy, enabledLocales: new Set(['en', 'bg']) });
    vi.spyOn(AccountRouteGuard, 'enforce').mockResolvedValue(undefined as never);
    vi.spyOn(HomePageResolver, 'resolve').mockResolvedValue({ content: { id: 1 }, resolution: null, forcedLayout: '' } as never);
    const document = vi.spyOn(StorefrontDocumentRenderer as any, 'document').mockResolvedValue(new Response('page'));
    const request = StorefrontDocumentRequest.from(path, new URL(`https://site.example/${path.join('/')}${query}`));
    await (StorefrontDocumentRenderer as any).route(request, new DocumentRenderTiming());
    return (document.mock.calls[0][0] as { locale: string }).locale;
  }

  it('takes the language from the query', async () => {
    expect(await localeOf([], '?locale=bg', LocaleUrlStrategy.QUERY)).toBe('bg');
  });

  it('takes the language from the path', async () => {
    expect(await localeOf(['bg'], '', LocaleUrlStrategy.PATH)).toBe('bg');
  });
});
