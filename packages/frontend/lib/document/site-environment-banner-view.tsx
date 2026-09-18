import type { ReactNode } from 'react';

/**
 * Says out loud that this site sends nothing, to everyone looking at it.
 *
 * A non-production site is a COPY — usually of a live shop, holding that shop's real customers and
 * real credentials. It looks exactly like the original, which is the point and also the hazard: its
 * checkout will refuse, its order confirmations will not arrive, and without this bar the person
 * testing it discovers that by filling in a card form and reading a stack trace.
 *
 * Shown to EVERY visitor, not only to the site's own people the way the preview bar is. Whoever is
 * looking at a copy needs to know it is a copy, and a non-production site may legitimately be
 * `unlisted` or even `public` while a client tries it.
 *
 * States the fact and offers nothing. Turning the brake off is a decision that belongs on the site's
 * page in the admin, beside everything else that governs it — never one click away from a storefront.
 */
export class SiteEnvironmentBannerView {
  static render({ visible }: { visible: boolean }): ReactNode {
    if (!visible) return null;
    return (
      <div className="fc-site-preview fc-site-preview--non-production" role="status">
        <span className="fc-site-preview__dot" aria-hidden="true" />
        <span>Non-production site — nothing leaves it.</span>
        <span className="fc-site-preview__note">No email, payment, shipment or scheduled job will be sent.</span>
      </div>
    );
  }
}
