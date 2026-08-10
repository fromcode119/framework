import { connection } from 'next/server';
import { TokenEmailPreferencesPanel } from '@fromcode119/react/account/token-email-preferences-panel.client';

/**
 * The global email preferences page — every stream this platform sends, on one screen, reachable from
 * a link in any message.
 *
 * A NATIVE route rather than a plugin page contract, and that is the point. A page materialized from a
 * contract renders through `DefaultPageDesignRenderer`, which resolves from a registry only the Next
 * bundle populates — so those pages paint an empty box on the server and fill in on hydration. This one
 * is a real route, so it renders server-side like `/verify-email` and `/forgot-password` beside it.
 *
 * It is also the only unsubscribe surface that can list streams from EVERY plugin. A plugin page
 * enumerating other plugins' categories would be the cross-plugin coupling the architecture forbids;
 * the suppression list and the category registry are framework-owned, so this page is too.
 *
 * No auth guard: most recipients have no account. The signed token in the query is the credential, and
 * the endpoint behind this panel derives the address from that token alone.
 */
export class UnsubscribePageRoute {
  static async render() {
    // Opt into dynamic rendering without a route-segment `export const`.
    await connection();
    return <TokenEmailPreferencesPanel />;
  }
}
