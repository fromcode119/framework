import { FrontendCopy } from '@/lib/i18n/frontend-copy';
import type { ReactNode } from 'react';

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
  /** `locale` is the document's `<html lang>`: the bar is server-rendered, so it cannot read it. */
  static render({ visible, locale }: { visible: boolean; locale?: string }): ReactNode {
    if (!visible) return null;
    return (
      <div className="fc-site-preview fc-site-preview--unpublished" role="status">
        <span className="fc-site-preview__dot" aria-hidden="true" />
        <span>{FrontendCopy.t(locale, 'frontend.siteBanner.previewTitle')}</span>
        <span className="fc-site-preview__note">{FrontendCopy.t(locale, 'frontend.siteBanner.previewNote')}</span>
      </div>
    );
  }
}
