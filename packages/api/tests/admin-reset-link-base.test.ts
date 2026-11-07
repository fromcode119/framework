import { describe, expect, it } from 'vitest';
import { AuthControllerUrlInfrastructure } from '@api/controllers/auth/auth-controller-infrastructure/auth-controller-url-infrastructure';

/**
 * An admin reset link lands exactly where the admin URL in Settings says the console is. A console at
 * the root of its own host must not get a default `/admin` appended — that page never loads.
 */
class Probe extends AuthControllerUrlInfrastructure {
  constructor(private readonly meta: Record<string, string>) { super({ db: {} } as any, {} as any); }
  protected async getMetaValue(key: string): Promise<string | null> { return this.meta[key] || null; }
  adminBase(): Promise<string> { return this.getAdminBaseUrl({ headers: {} } as any); }
}

describe('admin reset link base', () => {
  it('keeps a console at the root of its host at the root', async () => {
    expect(await new Probe({ admin_url: 'https://console.example.com/' }).adminBase()).toBe('https://console.example.com');
  });

  it('keeps a console mounted under a site at its path', async () => {
    expect(await new Probe({ admin_url: 'https://shop.example.com/admin' }).adminBase()).toBe('https://shop.example.com/admin');
  });

  it('never builds the link from the request host', async () => {
    await expect(new Probe({}).adminBase()).rejects.toThrow(/not configured/);
  });
});
