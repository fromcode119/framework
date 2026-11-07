/**
 * Containers created before `INTERNAL_API_URL` existed were told where their api is by `API_URL`, and
 * the updater carries a container's environment forward unchanged — so on an existing install that is
 * the ONLY address the admin and the storefront have for their api. Ignoring it left the storefront with
 * nothing but loopback guesses and took a shop down (0.2.532).
 *
 * Accepted strictly as that internal wiring: a container service name (`http://api:3000`) or an IP
 * address. A domain (`https://shop.example.com/api`) is refused — a public address is set in Settings.
 */
export class LegacyInternalApiUrl {
  static accept(normalized: string): string {
    if (!normalized) return '';
    try {
      const host = new URL(normalized).hostname;
      const isServiceName = !host.includes('.');
      const isAddress = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
      return isServiceName || isAddress ? normalized : '';
    } catch {
      return '';
    }
  }
}
