import { TenantMode } from '@fromcode119/core';

/**
 * Whether this database can keep sites apart. A deployment set up on one that cannot (setup labels
 * SQLite and MySQL "single site only") serves exactly one site and never gains a second: with a site
 * row present, the next boot refuses to start rather than serve several customers from one pool.
 */
export class SiteSupport {
  static get supported(): boolean {
    return TenantMode.isIsolationSupported();
  }

  /**
   * Refuses to bring a site into being where the next boot would refuse to start because of it.
   * Creating, importing and adopting each write the site row that turns sites on.
   */
  static assert(): void {
    if (SiteSupport.supported) return;
    throw Object.assign(new Error(
      'This installation\'s database keeps a single site and cannot keep several apart, so no site can be '
      + 'added to it — the platform would refuse to start with one. Restore a site\'s archive onto it instead.',
    ), { statusCode: 409 });
  }
}
