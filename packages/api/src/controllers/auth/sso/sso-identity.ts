/**
 * Who a provider says signed in: the only facts a social sign-in uses to find or create an account.
 * `emailVerified` is the provider's own statement; an address it does not vouch for never names an account.
 */
export class SsoIdentity {
  constructor(
    readonly email: string,
    readonly emailVerified: boolean,
    readonly firstName: string | null = null,
    readonly lastName: string | null = null,
  ) {}

  /** A provider's answer, as the `auth:sso:resolve-user` hook returns it. Only an explicit `true` is verified. */
  static from(payload: any): SsoIdentity {
    const text = (value: unknown): string | null => String(value ?? '').trim() || null;
    return new SsoIdentity(
      String(payload?.email ?? '').trim().toLowerCase(),
      payload?.emailVerified === true,
      text(payload?.firstName),
      text(payload?.lastName),
    );
  }
}
