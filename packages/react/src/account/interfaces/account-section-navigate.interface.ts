import type { MouseEvent as ReactMouseEvent } from 'react';

/**
 * In-shell section navigation, handed by the AccountShell to every panel it mounts.
 *
 * A panel that links to another account section calls this from the link's `onClick` instead of letting
 * the browser follow the `href`: the shell swaps the section via `history.pushState` + state, so the page
 * does not reload (a full load re-fetches nav/footer/auth/i18n and briefly paints the site's default page
 * before the account renders). The `href` stays on the anchor, so no-JS, middle-click and modified-click
 * still navigate normally — which is why this receives the event and decides.
 */
export interface IAccountSectionNavigate {
  (event: ReactMouseEvent<HTMLAnchorElement>, sectionKey: string, href: string): void;
}
