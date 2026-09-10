import type { NextRequest, NextResponse } from 'next/server';
import { StorefrontDocumentProxy } from '@/lib/document/storefront-document-proxy';

/**
 * Next.js middleware entry for the storefront — the authored source.
 *
 * All behaviour lives in `StorefrontDocumentProxy`. Next needs a `proxy` function and a `config` object
 * as module EXPORTS, neither of which a class can be; next-build-codegen's `MiddlewareGlueGenerator` writes
 * `proxy.ts` from these statics before the build (same contract as the admin's `AdminProxyRoute`).
 *
 * The matcher excludes everything that is never a document: the api proxy, Next internals, the runtime
 * assets (`fc-runtime`), the document route itself, the internal server-to-server endpoints, the well-known
 * files, and anything with a file extension.
 */
export class FrontendProxyRoute {
  static proxy(request: NextRequest): NextResponse {
    return StorefrontDocumentProxy.handle(request);
  }

  static readonly config = {
    matcher: [
      '/((?!api|_next|fc-runtime|fc-document|internal|favicon.ico|apple-touch-icon.png|robots.txt|sitemap.xml|.*\\.(?:js|mjs|css|json|map|png|jpg|jpeg|gif|svg|webp|avif|ico|woff|woff2|ttf|otf|webmanifest|xml|txt|pdf|mp4|webm)).*)',
    ],
  };
}
