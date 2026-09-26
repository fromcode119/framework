import type { NextRequest } from 'next/server';
import { StorefrontDocumentRenderer } from '@/lib/document/storefront-document-renderer';
import { StorefrontDocumentRequest } from '@/lib/document/storefront-document-request';
import { StorefrontDocumentCache } from '@/lib/document/storefront-document-cache';
import { DocumentCompression } from '@/lib/document/document-compression';
import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { CookieConstants } from '@fromcode119/core/client';

/**
 * The islands document route. Not addressed by visitors: the proxy rewrites `/` and every content
 * path here (see `FrontendProxyRoute`), and `fc-document` is
 * a reserved root segment, so a direct request for `/fc-document/...` from outside never resolves as
 * content either — it serves the same document the rewrite would, which is harmless.
 */
export class StorefrontDocumentRoute {
  static async GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }): Promise<Response> {
    const params = await context.params;
    const documentRequest = StorefrontDocumentRequest.from(params?.path, request.nextUrl, request.headers.get('accept-encoding') || '');
    const render = () => StorefrontDocumentRenderer.render(documentRequest);
    if (!StorefrontDocumentCache.cacheable(request.method, request.cookies.getAll().map((cookie) => cookie.name), request.nextUrl.searchParams)) {
      return StorefrontDocumentCache.bypass(await render());
    }
    // The same `/system/frontend` payload the render reads (request-scoped cache), so a miss fetches it once.
    const key = StorefrontDocumentCache.key({
      host: String(request.headers.get('x-forwarded-host') || request.headers.get('host') || ''),
      pathname: documentRequest.pathname,
      searchParams: request.nextUrl.searchParams,
      locale: String(request.cookies.get(CookieConstants.LOCALE)?.value || ''),
      encoding: DocumentCompression.negotiate(documentRequest.acceptEncoding),
      frontend: await FrontendConfigCache.read(),
    });
    if (!key) return StorefrontDocumentCache.bypass(await render());
    return StorefrontDocumentCache.read(key) ?? StorefrontDocumentCache.write(key, await render());
  }
}
