/** What the storefront's middleware learns about a host from `/system/frontend`, cached per host. */
export interface ISiteProxyVerdict {
  /** This visitor may be served the site (published, or the visitor previews it). */
  readable: boolean;
  /** The Content-Security-Policy its pages carry: set for a site whose theme the site uploaded. */
  contentSecurityPolicy: string | null;
}
