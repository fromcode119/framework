import { NextResponse, type NextRequest } from 'next/server';
import { CookieConstants, FileSharePageSlug } from '@fromcode119/core/client';
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
 * pages (`register`, `forgot-password`, `reset-password`, `verify-email*`, `unsubscribe`, `files`) keep their
 * routes for now (plan §7 open question 2), and everything that is not a document — api proxy, Next
 * internals, the runtime assets, the internal endpoints, files by extension — is excluded by the
 * proxy matcher before this runs. Only GET/HEAD navigations are documents.
 */
export class StorefrontDocumentProxy {
  static readonly DOCUMENT_PREFIX = '/fc-document';

  /**
   * Root segments that stay App Router pages. The file-share page is one (`app/files/[token]`); it was
   * missing here, so every share link emailed to a recipient was rewritten to the document route and
   * answered 404.
   */
  private static readonly NEXT_PAGE_SEGMENTS = new Set(['register', 'forgot-password', 'reset-password', 'verify-email', 'verify-email-change', 'unsubscribe', FileSharePageSlug.PATH, 'fc-document', 'internal', 'api', '_next']);

  /** App Router pages that render the site's theme: they carry its Content-Security-Policy too. */
  private static readonly THEMED_NEXT_PAGES = new Set(['register', 'forgot-password', 'reset-password', 'verify-email', 'verify-email-change', 'unsubscribe', FileSharePageSlug.PATH]);

  static async handle(request: NextRequest): Promise<NextResponse | Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') return NextResponse.next();
    const pathname = request.nextUrl.pathname;
    const themedPage = StorefrontDocumentProxy.THEMED_NEXT_PAGES.has(StorefrontDocumentProxy.firstSegment(pathname));
    if (!StorefrontDocumentProxy.isDocumentPath(pathname) && !themedPage) return NextResponse.next();

    // A site that is not published answers here, before any page runs. This is the only point every
    // document entry passes through — the islands route and both App Router pages each resolve
    // content of their own — and the only one that can answer 503 rather than render something.
    const host = String(request.headers.get('x-forwarded-host') || request.headers.get('host') || '');
    const apiBase = String(process.env.INTERNAL_API_URL || process.env.API_URL || '');
    // WHO is asking, not just where. A site's own people hold a preview cookie for this host; the
    // guard forwards it and lets the api decide. Read by name — nothing here interprets its value.
    const preview = String(request.cookies.get(CookieConstants.SITE_PREVIEW)?.value || '');
    const verdict = await SiteVisibilityProxyGuard.verdict(host, apiBase, preview);
    if (themedPage) return StorefrontDocumentProxy.withPolicy(NextResponse.next(), verdict.contentSecurityPolicy);
    if (!verdict.readable) return SiteVisibilityProxyGuard.holdingResponse();

    const target = request.nextUrl.clone();
    target.pathname = `${StorefrontDocumentProxy.DOCUMENT_PREFIX}${pathname === '/' ? '' : pathname}`;
    return StorefrontDocumentProxy.withPolicy(NextResponse.rewrite(target), verdict.contentSecurityPolicy);
  }

  /** A site whose theme the site uploaded limits where its pages load from and send to. */
  private static withPolicy(response: NextResponse, policy: string | null): NextResponse {
    if (policy) response.headers.set('Content-Security-Policy', policy);
    return response;
  }

  private static firstSegment(pathname: string): string {
    return (String(pathname || '').split('/').filter(Boolean)[0] || '').toLowerCase();
  }

  static isDocumentPath(pathname: string): boolean {
    if (StorefrontDocumentProxy.NEXT_PAGE_SEGMENTS.has(StorefrontDocumentProxy.firstSegment(pathname))) return false;
    return !/\.[a-z0-9]{2,5}$/i.test(pathname);
  }
}
