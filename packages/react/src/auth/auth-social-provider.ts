/** One provider the site offers for social sign-in, as `GET /auth/sso/providers` lists it. */
export class AuthSocialProvider {
  constructor(readonly key: string, readonly label: string) {}

  static list(response: any): AuthSocialProvider[] {
    const rows = Array.isArray(response?.providers) ? response.providers : [];
    return rows
      .map((row: any) => new AuthSocialProvider(String(row?.key || '').trim(), String(row?.label || '').trim()))
      .filter((provider: AuthSocialProvider) => provider.key && provider.label);
  }
}
