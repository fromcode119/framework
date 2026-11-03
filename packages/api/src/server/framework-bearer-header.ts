/**
 * Whether an `Authorization` header carries the framework's own credential: a Bearer JWT. Another
 * scheme (a plugin's signed `Authorization: Bridge …`) or a plugin's opaque bearer token is its
 * route's to check, so counting it as "a token the framework failed to accept" is wrong.
 */
export class FrameworkBearerHeader {
  private static readonly BEARER_JWT = /^Bearer\s+[\w-]+\.[\w-]+\.[\w-]+$/i;

  static carriesFrameworkToken(header: unknown): boolean {
    return FrameworkBearerHeader.BEARER_JWT.test(String(header || '').trim());
  }
}
