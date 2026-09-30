/**
 * Where an IP address is, approximately — as far as a public IP-to-location database can say.
 *
 * City precision at best, and often wrong by tens of kilometres: an address is where a network is
 * registered, not where a person stands. Nothing finer (no street, no coordinates) is offered, because
 * nothing finer can honestly be derived from an address.
 */
export interface IGeoLocation {
  /** ISO 3166-1 alpha-2, upper case (`BG`). */
  countryCode: string;
  /** English country name (`Bulgaria`). */
  country: string;
  /** First-level subdivision in English (`Sofia City`), or empty. */
  region: string;
  /** City in English (`Sofia`), or empty. */
  city: string;
}
