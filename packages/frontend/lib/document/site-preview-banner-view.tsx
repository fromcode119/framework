import type { ReactNode } from 'react';
import { SitePreviewBannerStylesheet } from '@/lib/document/site-preview-banner-stylesheet';

/**
 * Says out loud that this site is not published, to the one person looking at it.
 *
 * Without it the preview is indistinguishable from the live site, and the mistake that follows is
 * predictable: the operator sees their work, assumes the world does too, and never presses Publish.
 * A preview that is silent about being a preview is worse than no preview.
 *
 * The copy states the fact and nothing else. It does not offer to publish — that decision belongs on
 * the site's own page in the admin, with everything else that governs it, not on a bar floating over
 * a storefront where a stray click would make the site public.
 *
 * Rendered by BOTH document paths (the islands document and the App Router layout) above everything
 * the theme produces, so no theme can be required to know about it or able to suppress it.
 */
export class SitePreviewBannerView {
  static render({ visible }: { visible: boolean }): ReactNode {
    if (!visible) return null;
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: SitePreviewBannerStylesheet.css() }} />
        <div className="fc-site-preview" role="status">
          <span className="fc-site-preview__dot" aria-hidden="true" />
          <span>Not published — only you can see this.</span>
          <span className="fc-site-preview__note">Visitors get a holding page.</span>
        </div>
      </>
    );
  }
}
