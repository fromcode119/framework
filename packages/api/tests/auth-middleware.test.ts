import { AuthManager } from '@fromcode119/auth';
import { CookieConstants } from '../../core/src/cookie-constants';
import * as jwt from 'jsonwebtoken';

describe('AuthManager Middleware Conflict Fix', () => {
    let authManager: AuthManager;
    const secret = 'test-secret';

    beforeEach(() => {
        authManager = new AuthManager(secret);
    });

    it('should successfully authenticate when multiple cookies are present and one is valid', async () => {
        const validUser = { id: '1', email: 'test@example.com', roles: ['admin'] };
        const validToken = jwt.sign(validUser, secret);
        const invalidToken = 'totally-invalid-token';

        // Simulate Express request with multiple cookies in raw header
        // This simulates the host vs domain conflict where the browser sends:
        // Cookie: auth-token=invalid; auth-token=valid
        const req: any = {
            headers: {
                cookie: `${CookieConstants.AUTH_TOKEN}=${invalidToken}; ${CookieConstants.AUTH_TOKEN}=${validToken}`
            },
            url: '/api/test'
        };
        const res: any = {};
        const next = jest.fn();

        const middleware = authManager.middleware();
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toBeDefined();
        expect(req.user.email).toBe('test@example.com');
    });

    it('should successfully authenticate when cookies are in reverse order', async () => {
        const validUser = { id: '1', email: 'test@example.com', roles: ['admin'] };
        const validToken = jwt.sign(validUser, secret);
        const invalidToken = 'totally-invalid-token';

        const req: any = {
            headers: {
                cookie: `${CookieConstants.AUTH_TOKEN}=${validToken}; ${CookieConstants.AUTH_TOKEN}=${invalidToken}`
            },
            url: '/api/test'
        };
        const res: any = {};
        const next = jest.fn();

        const middleware = authManager.middleware();
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toBeDefined();
        expect(req.user.email).toBe('test@example.com');
    });

    it('should handle cookies from cookie-parser array format', async () => {
        const validUser = { id: '1', email: 'test@example.com', roles: ['admin'] };
        const validToken = jwt.sign(validUser, secret);
        const staleToken = jwt.sign({ ...validUser, exp: 0 }, secret); // Already expired

        const req: any = {
            cookies: {
                [CookieConstants.AUTH_TOKEN]: [staleToken, validToken]
            },
            headers: {},
            url: '/api/test'
        };
        const res: any = {};
        const next = jest.fn();

        const middleware = authManager.middleware();
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toBeDefined();
        expect(req.user.email).toBe('test@example.com');
    });

    it('should successfully authenticate with Bearer token even if cookies are invalid', async () => {
        const validUser = { id: '1', email: 'test@example.com', roles: ['admin'] };
        const validToken = jwt.sign(validUser, secret);
        const invalidToken = 'totally-invalid-token';

        const req: any = {
            headers: {
                authorization: `Bearer ${validToken}`,
                cookie: `${CookieConstants.AUTH_TOKEN}=${invalidToken}`
            },
            url: '/api/test'
        };
        const res: any = {};
        const next = jest.fn();

        const middleware = authManager.middleware();
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toBeDefined();
        expect(req.user.email).toBe('test@example.com');
    });
});
