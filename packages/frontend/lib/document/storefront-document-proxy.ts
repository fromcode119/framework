import { NextResponse, type NextRequest } from 'next/server';
import { CookieConstants } from '@fromcode119/core/client';
import { SiteVisibilityProxyGuard } from '@/lib/document/site-visibility-proxy-guard';

/**
 * Routes content requests to the islands document. Theme-agnostic by construction: the path says
 * WHAT, nothing names a theme or a plugin.
 *
 * It used to be a rollout flag (`STOREFRONT_DOCUMENT_ISLANDS`) that defaulted OFF, so local
 * development ran the islands document and production ran the App Router document: two render paths,
 * and the one visitors got was the slower one — a 405 KB React payload and a full hydration on every
 * page. Islands is now the only path for content documents; the flag is gone.
 *
 * Rewrites `/` and any path the App Router's `[...slug]` page would have served. The remaining Next
 * pages (`register`, `forgot-password`, `reset-password`, `verify-email*`, `unsubscribe`) keep their
 * routes for now (plan §7 open question 2), and everything that is not a document — api proxy, Next
 * internals, the runtime assets, the internal endpoints, files by extension — is excluded by the
 * proxy matcher before this runs. Only GET/HEAD navigations are documents.
 */
export class StorefrontDocumentProxy {
  static readonly DOCUMENT_PREFIX = '/fc-document';

  /** Root segments that stay App Router pages while the flag is on. */
  private static readonly NEXT_PAGE_SEGMENTS = new Set(['register', 'forgot-password', 'reset-password', 'verify-email', 'verify-email-change', 'unsubscribe', 'fc-document', 'internal', 'api', '_next']);

  static async handle(request: NextRequest): Promise<NextResponse | Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') return NextResponse.next();
    const pathname = request.nextUrl.pathname;
    if (!StorefrontDocumentProxy.isDocumentPath(pathname)) return NextResponse.next();

    // A site that is not published answers here, before any page runs. This is the only point every
    // document entry passes through — the islands route and both App Router pages each resolve
    // content of their own — and the only one that can answer 503 rather than render something.
    const host = String(request.headers.get('x-forwarded-host') || request.headers.get('host') || '');
    const apiBase = String(process.env.INTERNAL_API_URL || process.env.API_URL || '');
    // WHO is asking, not just where. A site's own people hold a preview cookie for this host; the
    // guard forwards it and lets the api decide. Read by name — nothing here interprets its value.
    const preview = String(request.cookies.get(CookieConstants.SITE_PREVIEW)?.value || '');
    if (!(await SiteVisibilityProxyGuard.isReadable(host, apiBase, preview))) {
      return SiteVisibilityProxyGuard.holdingResponse();
    }

    const target = request.nextUrl.clone();
    target.pathname = `${StorefrontDocumentProxy.DOCUMENT_PREFIX}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(target);
  }

  static isDocumentPath(pathname: string): boolean {
    const first = String(pathname || '').split('/').filter(Boolean)[0] || '';
    if (StorefrontDocumentProxy.NEXT_PAGE_SEGMENTS.has(first.toLowerCase())) return false;
    return !/\.[a-z0-9]{2,5}$/i.test(pathname);
  }
}
