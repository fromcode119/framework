/**
 * Transport settings shared by the server fetch helpers and the failure reporter.
 *
 * Its own file because BOTH ServerApiUtils (to arm the abort timer) and ServerApiErrors (to say how
 * long it waited) need them — leaving them on either would have made the two import each other.
 */
export class ServerApiConfig {
  static readonly SERVER_FETCH_TIMEOUT_MS = Number(process.env.SERVER_FETCH_TIMEOUT_MS || 12000);

  static readonly DEBUG_SERVER_FETCH = process.env.DEBUG_SERVER_FETCH === '1';
}
