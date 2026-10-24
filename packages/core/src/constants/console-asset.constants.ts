/**
 * Where a mounted console's built assets (`/_next/*`) are fetched from. A storefront host serves its
 * own `/_next`, so on that host the admin's must live under a root the storefront never uses. The
 * admin's `assetPrefix` is this path (under its base path), and the gateway hands it to the admin.
 *
 * Its own import-free file because the admin's next.config reads it, and a config file gets no path
 * aliases — anything this file imported would have to resolve without them.
 */
export class ConsoleAssetConstants {
  static readonly PREFIX = '/_fc-console' as const;
}
