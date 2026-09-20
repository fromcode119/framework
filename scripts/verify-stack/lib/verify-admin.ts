/**
 * The admin-API steps of `verify-stack.sh seed`, run INSIDE the api container against localhost.
 *
 *   verify-admin activate-theme <slug>
 *   verify-admin set-plugin-setting <pluginSlug> <key> <value>
 *
 * Credentials come from VERIFY_ADMIN_EMAIL / VERIFY_ADMIN_PASSWORD — the throwaway admin the seed step
 * created. TypeScript source; `verify-stack.sh` compiles it to an artifact and runs that.
 */

interface Reply {
  status: number;
  body: any;
}

class VerifyAdmin {
  private static readonly BASE = 'http://localhost:3000/api/v1';
  private static readonly HEADERS: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'verify-stack',
  };

  /**
   * CSRF: the api sets `fc_csrf` on any SAFE request and, on an unsafe one, requires the same value in
   * `x-csrf-token` — unless the request already carries `Authorization` or an API key. Login has
   * neither (that is the point of it), so it must present the pair the way a browser would.
   * `X-Requested-With` alone stopped being sufficient deliberately: a custom header is not
   * authentication, because another allowlisted origin can set one too.
   */
  private readonly jar = new Map<string, string>();

  private remember(response: Response): void {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';');
      const index = pair!.indexOf('=');
      if (index > 0) this.jar.set(pair!.slice(0, index).trim(), pair!.slice(index + 1).trim());
    }
  }

  async call(path: string, init: RequestInit = {}): Promise<Reply> {
    const cookie = [...this.jar].map(([key, value]) => `${key}=${value}`).join('; ');
    const csrf = this.jar.get('fc_csrf');

    const response = await fetch(`${VerifyAdmin.BASE}${path}`, {
      ...init,
      headers: {
        ...VerifyAdmin.HEADERS,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
        ...((init.headers as Record<string, string>) || {}),
      },
    });

    this.remember(response);
    const text = await response.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: response.status, body };
  }

  /** One safe request, purely to be handed the CSRF cookie before the first POST. */
  async primeCsrf(): Promise<void> {
    await this.call('/health');
  }

  async login(): Promise<Record<string, string>> {
    const { status, body } = await this.call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: process.env.VERIFY_ADMIN_EMAIL, password: process.env.VERIFY_ADMIN_PASSWORD }),
    });
    if (status !== 200 || !body?.token) throw new Error(`login failed: ${status} ${JSON.stringify(body).slice(0, 200)}`);
    return { Authorization: `Bearer ${body.token}` };
  }

  private async activateTheme(auth: Record<string, string>, slug: string): Promise<number> {
    const reply = await this.call(`/themes/${slug}/activate`, { method: 'POST', headers: auth, body: '{}' });
    console.log(`activate ${slug}: ${reply.status} ${JSON.stringify(reply.body).slice(0, 200)}`);
    return reply.status === 200 ? 0 : 1;
  }

  /** Written, then READ BACK: a 200 that did not store the value is the failure worth catching. */
  private async setPluginSetting(auth: Record<string, string>, plugin: string, key: string, value: string): Promise<number> {
    const current = await this.call(`/plugins/${plugin}/settings`, { headers: auth });
    if (current.status !== 200) throw new Error(`read settings failed: ${current.status}`);

    const settings = current.body?.settings ?? current.body?.data ?? current.body;
    const next = { ...(settings && typeof settings === 'object' ? settings : {}), [key]: value };

    const reply = await this.call(`/plugins/${plugin}/settings`, { method: 'PUT', headers: auth, body: JSON.stringify(next) });
    console.log(`set ${plugin}.${key}=${value}: ${reply.status}`);

    const check = await this.call(`/plugins/${plugin}/settings`, { headers: auth });
    const stored = check.body?.settings ?? check.body?.data ?? check.body;
    console.log(`read-back ${plugin}.${key}=${stored?.[key]}`);
    return reply.status === 200 && stored?.[key] === value ? 0 : 1;
  }

  static async main(argv: string[]): Promise<number> {
    const [command, ...args] = argv;
    const admin = new VerifyAdmin();

    await admin.primeCsrf();
    const auth = await admin.login();

    if (command === 'activate-theme') return admin.activateTheme(auth, args[0]!);
    if (command === 'set-plugin-setting') return admin.setPluginSetting(auth, args[0]!, args[1]!, args[2]!);

    console.error('unknown command');
    return 2;
  }
}

process.exit(await VerifyAdmin.main(process.argv.slice(2)));
