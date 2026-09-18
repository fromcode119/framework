import type { ReactNode } from 'react';
import { SitePreviewBannerStylesheet } from '@/lib/document/site-preview-banner-stylesheet';

/**
 * Where the site's status bars live, and the one place their stylesheet is written.
 *
 * MORE THAN ONE CAN BE TRUE AT ONCE. A site can be unpublished AND non-production, and the two say
 * different things — one is about who may look, the other about what the site will send — so neither
 * may be dropped in favour of the other. They used to be rendered as siblings, each `position: fixed;
 * bottom: 0`, which put them ON TOP of each other: whichever came second covered the first, and the
 * `padding-bottom` that keeps a bar off the page's own content only ever reserved one bar's height.
 * Three separate people read the two overlapping elements as the same banner rendered twice and
 * reported it as a duplication bug.
 *
 * Each bar also injected the shared stylesheet itself, so showing both wrote the same rules into the
 * document twice. It is written here instead, once, however many bars there are.
 *
 * TAKES ALREADY-RENDERED BARS, not children and not flags. Not flags, because the two documents that
 * mount this show different sets — the App Router layout shows both, the islands document shows only
 * the preview bar — and a flag would make one of them pass a value it does not mean. Not children,
 * because a bar decides for itself whether it has anything to say and returns null: as CHILDREN the
 * elements are always present and only their OUTPUT is null, so counting them says "two bars" on a
 * page with none. Evaluated first, a hidden bar is simply null here and filters out.
 */
export class SiteBannersView {
  static render({ bars }: { bars: readonly ReactNode[] }): ReactNode {
    const shown = bars.filter(Boolean);
    // Nothing to say, nothing written — not even the stylesheet, which carries the `padding-bottom`
    // that reserves a bar's height and would otherwise shorten every bar-less page.
    if (shown.length === 0) return null;
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: SitePreviewBannerStylesheet.css() }} />
        <div className="fc-site-banners">{shown}</div>
      </>
    );
  }
}
