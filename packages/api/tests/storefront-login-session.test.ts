import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { SystemConstants, TenantMode } from '@fromcode119/core';
import { AuthControllerPolicy } from '@api/controllers/auth/auth-controller-policy';

/**
 * A customer signs in on a site's storefront, end to end through the real session issuer.
 *
 * The session used to come back tied to NO site: login entered only a site the account ADMINISTERS,
 * and a customer administers nothing. The storefront then refused that session on the very next
 * request ("minted for no tenant, presented to <site>") and the customer landed on the login page
 * again. The assertion reads the tenant claim the storefront checks.
 */
const SECRET = 'test-secret';

/** One flat in-memory database: the tables the session issuer reads, keyed by name. */
class DatabaseStub {
  readonly inserted: Array<{ table: string; row: any }> = [];
  constructor(private readonly memberships: any[]) {}

  async find(table: string, query: any = {}): Promise<any[]> {
    if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) {
      const where = query?.where ?? query ?? {};
      return this.memberships.filter((row) => Object.entries(where).every(([k, v]) => typeof v !== 'string' || row[k] === v));
    }
    return [];
  }

  async findOne(table: string, where: any = {}): Promise<any> {
    if (table === SystemConstants.TABLE.TENANT_MEMBERSHIPS) {
      return this.memberships.find((row) => row.user_id === where.user_id && row.tenant_id === where.tenant_id) ?? null;
    }
    return null;
  }

  async insert(table: string, row: any): Promise<any> {
    this.inserted.push({ table, row });
    return row;
  }

  async update(): Promise<boolean> { return true; }
  async withPlatformAdmin<T>(fn: () => Promise<T>): Promise<T> { return fn(); }
  async execute(): Promise<any[]> { return []; }
}

class SessionProbe extends AuthControllerPolicy {
  issue(req: any, res: any, user: any) {
    return this.issueLoginSession(req, res, user);
  }
}

const probe = (db: DatabaseStub) => {
  const manager: any = { db, hooks: { call: vi.fn(), emit: vi.fn(), on: vi.fn() } };
  const auth: any = {
    getUserPermissions: vi.fn().mockResolvedValue([]),
    getPermissionsForRoles: vi.fn().mockResolvedValue([]),
    generateToken: vi.fn(async (user: any, options: any) =>
      jwt.sign({ ...user, ...(options?.tenantId ? { tenantId: options.tenantId } : {}) }, SECRET, { algorithm: 'HS256', expiresIn: '5m' })),
  };
  return new SessionProbe(manager, auth);
};

const storefrontRequest = (tenantId: string) => ({
  tenantSurface: 'storefront',
  tenant: { id: tenantId },
  headers: { host: `${tenantId}.example`, 'user-agent': 'test' },
  cookies: {},
  get: (name: string) => (name.toLowerCase() === 'host' ? `${tenantId}.example` : undefined),
  path: '/api/v1/auth/login',
  protocol: 'https',
  secure: true,
  ip: '127.0.0.1',
  socket: { remoteAddress: '127.0.0.1' },
});

const response = () => ({ cookie: vi.fn(), clearCookie: vi.fn() });

describe('a customer signing in on a storefront', () => {
  beforeEach(() => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true }));
  afterEach(() => TenantMode.reset());

  it("gets a session tied to that storefront's site", async () => {
    const db = new DatabaseStub([{ user_id: '7', tenant_id: 'shop', roles: '["customer"]', state: 'active' }]);
    const { token } = await probe(db).issue(storefrontRequest('shop'), response(), { id: 7, email: 'buyer@example.com', roles: ['customer'] });

    expect((jwt.verify(token, SECRET) as any).tenantId).toBe('shop');
  });

  it('is not tied to a storefront whose site it has no membership in', async () => {
    const db = new DatabaseStub([]);
    const { token } = await probe(db).issue(storefrontRequest('shop'), response(), { id: 8, email: 'stranger@example.com', roles: ['customer'] });

    expect((jwt.verify(token, SECRET) as any).tenantId).toBeUndefined();
  });
});
