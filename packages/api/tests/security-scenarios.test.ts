import { CSRFMiddleware } from '../src/middlewares/csrf-middleware';
import { CookieConstants } from '../../core/src/cookie-constants';
import { Request, Response, NextFunction } from 'express';

describe('CSRF Middleware Security Scenarios', () => {
    let req: any;
    let res: any;
    let next: NextFunction;
    let csrfMiddleware: CSRFMiddleware;

    beforeEach(() => {
        csrfMiddleware = new CSRFMiddleware();
        req = {
            method: 'POST',
            path: '/api/v1/test',
            hostname: 'admin.framework.local',
            protocol: 'http',
            get: jest.fn().mockReturnValue(''),
            headers: {},
            cookies: {}
        };
        res = {
            cookie: jest.fn(),
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        next = jest.fn();
    });

    it('should allow GET requests without CSRF check', () => {
        req.method = 'GET';
        void csrfMiddleware.handle(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should block POST requests without CSRF header', () => {
        req.headers.cookie = `${CookieConstants.AUTH_CSRF}=valid-token`;
        void csrfMiddleware.handle(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Invalid CSRF token'
        }));
    });

    it('should block POST requests with mismatched CSRF header', () => {
        req.headers.cookie = `${CookieConstants.AUTH_CSRF}=valid-token`;
        req.headers['x-csrf-token'] = 'invalid-token';
        void csrfMiddleware.handle(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow POST requests with matching CSRF header', () => {
        req.headers.cookie = `${CookieConstants.AUTH_CSRF}=valid-token`;
        req.headers['x-csrf-token'] = 'valid-token';
        void csrfMiddleware.handle(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should successfully validate when multiple CSRF cookies are present and one matches the header', () => {
        const matchingToken = 'token-one';
        const otherToken = 'token-two';
        
        // Browser sends multiple cookies due to host vs domain conflict
        req.headers.cookie = `${CookieConstants.AUTH_CSRF}=${otherToken}; ${CookieConstants.AUTH_CSRF}=${matchingToken}`;
        req.headers['x-csrf-token'] = matchingToken;
        
        void csrfMiddleware.handle(req, res, next);
        
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should successfully validate when multiple CSRF cookies are present in reverse order', () => {
        const matchingToken = 'token-one';
        const otherToken = 'token-two';
        
        req.headers.cookie = `${CookieConstants.AUTH_CSRF}=${matchingToken}; ${CookieConstants.AUTH_CSRF}=${otherToken}`;
        req.headers['x-csrf-token'] = matchingToken;
        
        void csrfMiddleware.handle(req, res, next);
        
        expect(next).toHaveBeenCalled();
    });

    it('should generate a new CSRF cookie if none exists', () => {
        req.method = 'GET';
        void csrfMiddleware.handle(req, res, next);
        
        expect(res.cookie).toHaveBeenCalledWith(CookieConstants.AUTH_CSRF, expect.any(String), expect.objectContaining({
            httpOnly: false,
            path: '/'
        }));
        expect(next).toHaveBeenCalled();
    });

    it('should set the domain correctly on the fresh CSRF cookie if hostname is a subdomain', () => {
        req.method = 'GET';
        req.hostname = 'admin.framework.local';
        void csrfMiddleware.handle(req, res, next);
        
        expect(res.cookie).toHaveBeenCalledWith(CookieConstants.AUTH_CSRF, expect.any(String), expect.objectContaining({
            domain: '.framework.local'
        }));
    });

    it('should skip CSRF check for Authorization header (stateless/safe from CSRF)', () => {
        req.headers.authorization = 'Bearer some-token';
        // No cookie, no header
        void csrfMiddleware.handle(req, res, next);
        expect(next).toHaveBeenCalled();
    });
    
    it('should skip CSRF check for API Key header', () => {
        req.headers['x-api-key'] = 'some-key';
        void csrfMiddleware.handle(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
