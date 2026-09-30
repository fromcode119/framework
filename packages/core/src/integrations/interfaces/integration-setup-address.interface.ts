/**
 * An address on the site that the provider's own dashboard must be told about — an OAuth redirect URI,
 * a webhook endpoint. The provider declares the PATH; the admin shows it on the site's storefront
 * address, because that is where the provider will send the browser or the call.
 */
export interface IIntegrationSetupAddress {
  label: string;
  path: string;
  description?: string;
}
