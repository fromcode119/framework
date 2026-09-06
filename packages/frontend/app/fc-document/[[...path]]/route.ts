import type { NextRequest } from 'next/server';
import { StorefrontDocumentRenderer } from '@/lib/document/storefront-document-renderer';
import { StorefrontDocumentRequest } from '@/lib/document/storefront-document-request';

/**
 * The islands document route. Not addressed by visitors: the proxy rewrites `/` and every content
 * path here while `STOREFRONT_DOCUMENT_ISLANDS` is on (see `FrontendProxyRoute`), and `fc-document` is
 * a reserved root segment, so a direct request for `/fc-document/...` from outside never resolves as
 * content either — it serves the same document the rewrite would, which is harmless.
 */
export class StorefrontDocumentRoute {
  static async GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }): Promise<Response> {
    const params = await context.params;
    return StorefrontDocumentRenderer.render(StorefrontDocumentRequest.from(params?.path, request.nextUrl, request.headers.get('accept-encoding') || ''));
  }
}
