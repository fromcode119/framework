import { Enum } from '@fromcode119/react-class-components';

/**
 * The sections of a site's page.
 *
 * Split because the page was one scroll — identity, then twenty-five member rows, then exports and
 * delete far below them. Every comparable console (WordPress Multisite's Edit Site, Vercel's project
 * settings) separates these rather than stacking them, for the same reason: the long list buries
 * everything after it.
 */
export class SiteTab extends Enum {
  /** Identity, addressing and the two ways into the site. Short by design. */
  static readonly OVERVIEW = new SiteTab('overview', 'Overview');
  /** What this site is ENTITLED to run — plugins, theme, appearance. Not their settings. */
  static readonly ACCESS = new SiteTab('access', 'Access');
  /** The site's addresses, and the certificate each one is served over HTTPS with. */
  static readonly DOMAINS = new SiteTab('domains', 'Domains');
  static readonly MEMBERS = new SiteTab('members', 'Members');
  static readonly EXPORTS = new SiteTab('exports', 'Exports');
  static readonly DANGER = new SiteTab('danger', 'Danger');

  private constructor(value: string, readonly label: string) {
    super(value);
  }

  static resolve(value: unknown): SiteTab {
    return (SiteTab.fromValue(String(value ?? '')) as SiteTab | undefined) ?? SiteTab.OVERVIEW;
  }
}
