import { afterEach, describe, expect, it, vi } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { SsoOauthProvider } from '@api/controllers/auth/sso/enums/sso-oauth-provider.enum';
import { SsoOauthClient } from '@api/controllers/auth/sso/sso-oauth-client';
import { SsoUserResolverService } from '@api/controllers/auth/sso/sso-user-resolver-service';

/**
 * What each provider is trusted to say about an email address. The address is what joins a provider
 * identity to an account, so "verified" must come from the provider itself and never be assumed.
 */
const config = { clientId: 'client-1', clientSecret: 'secret-1', scopes: '' };

/** A fetch that answers each URL with the JSON registered for it. */
const answer = (routes: Record<string, any>) => vi.fn(async (url: string) => {
  const body = routes[String(url)];
  return { ok: body !== undefined, status: body === undefined ? 404 : 200, json: async () => body };
});

afterEach(() => vi.unstubAllGlobals());

describe('SsoOauthClient', () => {
  it('builds an authorization URL with PKCE, state and the provider default scopes', () => {
    const url = new URL(new SsoOauthClient(SsoOauthProvider.GOOGLE, config).authorizationUrl('https://shop.example/cb', 'st', 'ch'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code', client_id: 'client-1', redirect_uri: 'https://shop.example/cb',
      scope: 'openid email profile', state: 'st', code_challenge: 'ch', code_challenge_method: 'S256',
    });
  });

  it('is not usable without a client secret, or an OpenID provider without endpoints', () => {
    expect(new SsoOauthClient(SsoOauthProvider.GOOGLE, { clientId: 'x' }).configured).toBe(false);
    expect(new SsoOauthClient(SsoOauthProvider.OPENID, config).configured).toBe(false);
    expect(new SsoOauthClient(SsoOauthProvider.OPENID, { ...config, authorizeUrl: 'https://id.example/auth', tokenUrl: 'https://id.example/token' }).configured).toBe(true);
  });

  it('Google: sends the PKCE verifier with the code and takes email_verified from userinfo', async () => {
    const fetchMock = answer({
      'https://oauth2.googleapis.com/token': { access_token: 'at' },
      'https://openidconnect.googleapis.com/v1/userinfo': { email: 'Ana@Example.com', email_verified: true, given_name: 'Ana', family_name: 'Petrova' },
    });
    vi.stubGlobal('fetch', fetchMock);
    const identity = await new SsoOauthClient(SsoOauthProvider.GOOGLE, config).identify('code-1', 'https://shop.example/cb', 'verifier-1');
    expect(identity).toMatchObject({ email: 'ana@example.com', emailVerified: true, firstName: 'Ana', lastName: 'Petrova' });
    const body = new URLSearchParams(String((fetchMock.mock.calls[0] as any)[1].body));
    expect(body.get('code_verifier')).toBe('verifier-1');
    expect(body.get('code')).toBe('code-1');
  });

  it('GitHub: uses the PRIMARY address, and only as verified as GitHub says it is', async () => {
    vi.stubGlobal('fetch', answer({
      'https://github.com/login/oauth/access_token': { access_token: 'at' },
      'https://api.github.com/user': { name: 'Ana Maria Petrova' },
      'https://api.github.com/user/emails': [
        { email: 'other@example.com', primary: false, verified: true },
        { email: 'main@example.com', primary: true, verified: false },
      ],
    }));
    const identity = await new SsoOauthClient(SsoOauthProvider.GITHUB, config).identify('c', 'https://shop.example/cb', 'v');
    expect(identity).toMatchObject({ email: 'main@example.com', emailVerified: false, firstName: 'Ana', lastName: 'Maria Petrova' });
  });

  it('GitHub: a refused exchange (200 with an error field) fails the sign-in', async () => {
    vi.stubGlobal('fetch', answer({ 'https://github.com/login/oauth/access_token': { error: 'bad_verification_code' } }));
    await expect(new SsoOauthClient(SsoOauthProvider.GITHUB, config).identify('c', 'u', 'v')).rejects.toThrow(/bad_verification_code/);
  });

  const microsoftToken = (claims: Record<string, unknown>) => jwt.sign(
    { aud: 'client-1', email: 'ana@contoso.com', name: 'Ana Petrova', ...claims },
    'irrelevant', { expiresIn: '5m' },
  );
  const microsoft = async (claims: Record<string, unknown>) => {
    vi.stubGlobal('fetch', answer({ 'https://login.microsoftonline.com/common/oauth2/v2.0/token': { access_token: 'at', id_token: microsoftToken(claims) } }));
    return new SsoOauthClient(SsoOauthProvider.MICROSOFT, config).identify('c', 'u', 'v');
  };

  it('Microsoft: a personal account address is verified', async () => {
    const tid = SsoOauthProvider.MICROSOFT_CONSUMER_TENANT;
    expect((await microsoft({ tid, iss: `https://login.microsoftonline.com/${tid}/v2.0` })).emailVerified).toBe(true);
  });

  it('Microsoft: a work account address counts only with xms_edov', async () => {
    const tid = '11111111-2222-3333-4444-555555555555';
    const iss = `https://login.microsoftonline.com/${tid}/v2.0`;
    expect((await microsoft({ tid, iss })).emailVerified).toBe(false);
    expect((await microsoft({ tid, iss, xms_edov: true })).emailVerified).toBe(true);
  });

  it('Microsoft: an id token for another application is refused', async () => {
    const tid = SsoOauthProvider.MICROSOFT_CONSUMER_TENANT;
    await expect(microsoft({ tid, iss: `https://login.microsoftonline.com/${tid}/v2.0`, aud: 'someone-else' })).rejects.toThrow(/different application/);
  });
});

describe('SsoUserResolverService audiences', () => {
  it('reads the client ID from the provider entry CONFIG, where the Federated Login form stores it', async () => {
    const manager: any = {
      integrations: { getConfig: vi.fn(async () => ({ storedProviders: [{ id: 'g', providerKey: 'google', enabled: true, config: { clientId: 'client-1' } }] })) },
    };
    const audiences = await (new SsoUserResolverService(manager) as any).getAudiences('google');
    expect(audiences).toEqual(['client-1']);
  });
});
