/**
 * The catalogue an installation browses when neither Settings → General nor the deployment's
 * `MARKETPLACE_URL` names one.
 *
 * Its own file because BOTH sides need it and they cannot share a module: the services that resolve
 * the catalogue read platform settings and touch the database, which must never be pulled into the
 * admin bundle — and the admin has to state the default beside the field that overrides it, or the
 * operator cannot tell what "blank" means.
 */
export class MarketplaceDefaults {
  /** The publisher's public marketplace. Any marketplace address works; `off` turns browsing off. */
  static readonly ADDRESS = 'https://marketplace.fromcodeframework.com';
}
