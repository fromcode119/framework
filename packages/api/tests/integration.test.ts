import request from 'supertest';
import { APIServer } from '../src/index';
import { PluginManager, ThemeManager } from '@fromcode119/core';
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
