export interface IPluginApiResolver {
  has(namespace: string, slug: string): boolean;
  resolve(namespace: string, slug: string): unknown;
  /** The slugs this resolver would resolve in `namespace`, for finding peers by what they offer. */
  slugs(namespace: string): string[];
}
