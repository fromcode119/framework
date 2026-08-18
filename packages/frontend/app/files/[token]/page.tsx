import { connection } from 'next/server';
// From core/CLIENT, not the full barrel: importing `@fromcode119/core` here drags server-only modules
// (sandbox-manager's `import x = require()`) into the Next build.
import { FileSharePageSlug } from '@fromcode119/core/client';
import { FileSharePanel } from '@fromcode119/react/files/file-share-panel.client';
import { DynamicContentClient } from '@/app/components/view/dynamic-content-client.client';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { QueryParamUtils } from '@/lib/query-param-utils';

/**
 * The page a share-link recipient lands on.
 *
 * A NATIVE route, deliberately — the same reasoning as `/unsubscribe` beside it. A page materialized
 * from a plugin contract renders through `DefaultPageDesignRenderer`, which resolves from a registry
 * only the Next bundle populates, so those pages paint an empty box on the server and fill in on
 * hydration. It is also not served off the API origin the way another plugin's share page is: that pattern
 * puts an `/api/v1/...` URL in front of a customer and bypasses the theme's layout, nav and footer
 * entirely, which is documented as a bug on this very route's sibling.
 *
 * It resolves a themed content page first so the panel sits inside the site's chrome, and falls back to the
 * framework's own panel when a theme seeds no such page. A file link must work on every install, so a
 * missing content page degrades the CHROME and never the function.
 *
 * No auth guard: most recipients have no account, and the token in the path is the credential. The
 * endpoint behind the panel derives the grant from that token alone and ignores any address in the
 * request, so this cannot be aimed at someone else. The panel reads the token from the URL itself, so
 * it survives the themed-page path untouched.
 */
export class FileSharePageRoute {
  /** The content slug a theme seeds to brand this route — the same constant the emailed link is built from. */
  static readonly PAGE_SLUG = FileSharePageSlug.CONTENT_PAGE_SLUG;

  static async render({
    searchParams,
  }: {
    params?: Record<string, string> | Promise<Record<string, string>>;
    searchParams?: (Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>);
  }) {
    // Opt into dynamic rendering without a route-segment `export const`. Required here regardless:
    // the page's content depends entirely on a token, so it must never be statically cached.
    await connection();

    try {
      const resolvedSearchParams = await QueryParamUtils.resolveSearchParams(searchParams);
      const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
      const locale = await DynamicPageResolver.resolveLocale(resolvedSearchParams, '', routingConfig.strategy);
      const content = await DynamicPageResolver.resolveDocWithPermalinkFallback(
        FileSharePageRoute.PAGE_SLUG,
        resolvedSearchParams,
        locale,
        routingConfig.strategy,
      );
      if (content) {
        return <DynamicContentClient content={content} />;
      }
    } catch {
      // fall through to the framework default
    }

    return <FileSharePanel />;
  }
}
