import type { IStorefrontRedirectRule } from '@/lib/interfaces/storefront-redirect-rule.interface';

/** A resolved frontend document (content page or plugin doc) from the dynamic page resolver. */
export interface IResolvedDocResult {
  type: string;
  plugin: string;
  doc: Record<string, unknown> | null;
  /**
   * The ONE path this document is served at, as declared by the plugin that owns it — root-relative and
   * locale-free, or `''` when the owner declares none. A request on any other path redirects here.
   */
  canonicalPath: string;
  /** Read with the operator's preview rights (`?preview=1` with an admin session): the page says it is a preview. */
  preview?: boolean;
  /** The redirect rule the API matched for this path when nothing resolved to content, or null. */
  redirect?: IStorefrontRedirectRule | null;
  /** True when this lookup was the request's last one and told the API to report a miss (`missed=1`). */
  missReported?: boolean;
}
