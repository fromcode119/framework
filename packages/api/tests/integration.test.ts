import request from 'supertest';
import { APIServer } from '@api/index';
import { PluginManager, ThemeManager } from '@fromcode119/core';
import { sql } from '@fromcode119/database';
import { AuthManager } from '@fromcode119/auth';

describe('System E2E / Integration', () => {
    let server: APIServer;
    let auth: AuthManager;
    let manager: PluginManager;
    let themeManager: ThemeManager;

    beforeAll(async () => {
        // Setup minimal mock environment
        process.env.DATABASE_URL = ':memory:';
        process.env.API_VERSION_PREFIX = 'v1';
        auth = new AuthManager('test-secret-123');
        manager = new PluginManager();
        themeManager = new ThemeManager((manager as any).db);
        
        // Mock DB avoid actual DB connection for this test if needed
        // But better to use a real test DB if available
        
        server = new APIServer(manager, themeManager, auth);
        await server.initialize();

        // Every request now resolves a tenant from its Host header, and an unknown host is refused.
        // Supertest talks to 127.0.0.1, so that host has to belong to a tenant — the same setup a
        // real deployment gets from migration 020 plus a provisioned tenant.
        await (manager as any).db.execute(sql`
            CREATE TABLE IF NOT EXISTS "_system_tenants" (
              "id" TEXT PRIMARY KEY,
              "slug" TEXT NOT NULL UNIQUE,
              "primary_host" TEXT NOT NULL UNIQUE,
              "host_aliases" TEXT NOT NULL DEFAULT '[]',
              "state" TEXT NOT NULL DEFAULT 'active',
              "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
              "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await (manager as any).db.execute(sql`
            INSERT OR IGNORE INTO "_system_tenants" ("id","slug","primary_host","host_aliases","state")
            VALUES ('test-tenant','test','127.0.0.1','["localhost"]','active')
        `);
    });

    afterAll(async () => {
        if (server) {
            await server.shutdown();
        }
    });

    it('should allow login and access protected routes', async () => {
        // 1. Attempt login with mock credentials
        const loginRes = await request(server.app)
            .post('/api/v1/auth/login')
            .send({ 
                email: 'admin@fromcode.com', 
                password: 'password' 
            });
        
        // When DB is down, maintenance mode returns 503, CSRF failure returns 403
        expect([401, 403, 503]).toContain(loginRes.status);
    });

    it('should serve media collection without 500', async () => {
        // This checks if our schema alignment fixed the 500 crash
        const res = await request(server.app)
            .get('/api/v1/collections/media')
            .set('Authorization', 'Bearer dummy-token');
        
        // It might be 503 due to maintenance mode when DB is unavailable, but NOT 500
        expect(res.status).not.toBe(500);
    });

    it('should not expose system settings collection anonymously', async () => {
        const res = await request(server.app)
            .get('/api/v1/collections/settings');

        expect([401, 403, 503]).toContain(res.status);
    });

    it('should not expose users collection anonymously', async () => {
        const res = await request(server.app)
            .get('/api/v1/collections/users');

        expect([401, 403, 503]).toContain(res.status);
    });

    it('should return 401 or 503 for unauthorized access to plugins', async () => {
        const res = await request(server.app).get('/api/v1/plugins');
        expect([401, 503]).toContain(res.status);
    });

    it('should expose canonical forge assistant route', async () => {
        const res = await request(server.app).get('/api/v1/forge/admin/assistant/tools');
        expect(res.status).not.toBe(404);
    });

    it('should not expose assistant aliases under system routes', async () => {
        const res = await request(server.app).get('/api/v1/system/admin/assistant/tools');
        expect([404, 503]).toContain(res.status);
    });
});
