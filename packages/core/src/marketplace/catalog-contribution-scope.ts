import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';

/**
 * May THIS request be offered the things this installation built itself?
 *
 * The marketplace screens merge two different lists that look identical once rendered:
 *
 *   the REMOTE catalogue — what the configured marketplace publishes. A catalogue exists to show
 *                          you things you do not have; that is the whole point of one.
 *   CONTRIBUTIONS        — what this installation built on its own server (Sources records a theme
 *                          or plugin it built and offers it). This is not a catalogue. It is the
 *                          box's own inventory, and on a multi-tenant platform that inventory is
 *                          other customers' bespoke work.
 *
 * Offering the second list to a tenant-bound request named those customers' themes and plugins, by
 * slug, with an Install button beside each. The Marketplace SCREEN is a site's own — a site behaves
 * like its own installation, so it has one — but what this particular box happens to have built is
 * the operator's business, answered in PLATFORM scope.
 *
 * A site whose remote catalogue is unset or unreachable therefore sees an EMPTY marketplace, which is
 * the honest answer: nothing is on offer to it. It is not the same as "there is nothing here", and
 * the screen says which.
 *
 * Single-tenant deployments always see contributions — there is no second customer to hide them from,
 * and a lone installation that could not install what it had just built could not install at all.
 */
export class CatalogContributionScope {
  static offeredHere(): boolean {
    if (!TenantMode.isEnabled()) return true;
    return !String(RequestContextUtils.getTenantId() ?? '').trim();
  }
}
